// server.js
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
const sharedSession = require("express-socket.io-session");

const app = express();
const PORT = process.env.PORT || 3000;

// HTTP 서버와 Socket.IO 서버 연결
const server = http.createServer(app);
const io = new Server(server);

// 데이터 파일 경로
const usersFile = path.join(__dirname, 'users.json');
const postsFile = path.join(__dirname, 'posts.json');

// 세션 미들웨어
const sessionMiddleware = session({
  secret: 'my-secret',
  resave: false,
  saveUninitialized: true
});
app.use(sessionMiddleware);
io.use(sharedSession(sessionMiddleware, { autoSave: true }));

// 파일 없을 경우 초기화
if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, JSON.stringify([], null, 2));
if (!fs.existsSync(postsFile)) fs.writeFileSync(postsFile, JSON.stringify([], null, 2));

// ===================== 미들웨어 ===================== //
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname)); // 이미지 파일 접근 가능

// 🔐 부서 비밀번호
const departmentPasswords = { "총무팀": "1111", "인사팀": "2222", "회계팀": "3333" };

// ===================== 라우터 ===================== //

// 기본 화면
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'main.html')));

// 회원가입
app.post('/signup', (req, res) => {
  const { ID, password, email } = req.body;
  const users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
  if (users.find(u => u.ID === ID)) return res.send('<h3>이미 존재하는 아이디입니다.</h3><a href="/signup.html">돌아가기</a>');

  users.push({ ID, password, email, role: 'user', team: "" });
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  res.send('<h2>🎉 회원가입 완료!</h2><a href="/login.html">로그인</a>');
});

// 로그인
app.post('/login', (req, res) => {
  const { ID, password } = req.body;
  const users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
  const user = users.find(u => u.ID === ID && u.password === password);
  if (!user) return res.send('<h3>아이디 또는 비밀번호 틀림 😢</h3><a href="/login.html">돌아가기</a>');

  req.session.user = user;
  res.redirect('/member.html');
});

// 아이디 찾기
app.post('/find_id', (req, res) => {
  const { email } = req.body;
  const users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
  const user = users.find(u => u.email === email);
  if (user) res.send(`<p>아이디: <strong>${user.ID}</strong></p><a href="/login.html">로그인</a>`);
  else res.send('<p>이메일로 가입된 아이디 없음 😢</p><a href="/find_id.html">다시</a>');
});

// 비밀번호 찾기
app.post('/find_pw', (req, res) => {
  const { email } = req.body;
  const users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
  const user = users.find(u => u.email === email);
  if (user) res.send(`<p>${user.email} 계정 비밀번호: <strong>${user.password}</strong></p><a href="/login.html">로그인</a>`);
  else res.send('<p>해당 이메일로 비밀번호를 찾을 수 없음 😢</p><a href="/find_pw.html">다시</a>');
});

// 게시글 작성
app.post('/post', (req, res) => {
  const user = req.session.user; if(!user) return res.status(401).send('로그인 필요');
  const { title, content } = req.body;
  const isPrivate = req.body.private === 'on';
  const posts = JSON.parse(fs.readFileSync(postsFile, 'utf8'));
  posts.unshift({ author: user.ID, title, content, private: isPrivate });
  fs.writeFileSync(postsFile, JSON.stringify(posts, null, 2));
  res.send('작성 완료');
});

// 게시글 조회
app.get('/posts', (req, res) => {
  const user = req.session.user; if(!user) return res.status(401).send('로그인 필요');
  const posts = JSON.parse(fs.readFileSync(postsFile, 'utf8'));
  const filtered = posts.filter(p => !p.private || p.author === user.ID || user.role === 'admin');
  res.json(filtered);
});

// 현재 로그인 유저 정보
app.get('/me', (req, res) => {
  if(!req.session.user) return res.status(401).json({error:'로그인 필요'});
  res.json(req.session.user);
});

// 조합원 목록
app.get('/members', (req, res) => {
  if(!req.session.user) return res.status(401).send('로그인 필요');
  const users = JSON.parse(fs.readFileSync(usersFile,'utf-8'));
  res.json(users);
});

// 부서 입장
app.post('/join-department', (req, res) => {
  if(!req.session.user) return res.status(401).json({success:false,error:'로그인 필요'});
  const { name, password } = req.body;
  if(departmentPasswords[name] && departmentPasswords[name] === password) {
    req.session.currentDept = name;
    return res.json({success:true});
  }
  return res.json({success:false});
});

// 팀별 채팅 목록
app.get('/chat', (req,res) => {
  if(!req.session.user) return res.status(401).send('로그인 필요');
  const users = JSON.parse(fs.readFileSync(usersFile,'utf-8'));
  const dept = req.session.currentDept || req.session.user.team;
  const list = dept ? users.filter(u=>u.team===dept) : [];
  res.json(list);
});

// 현재 부서 반환
app.get('/get-current-dept', (req,res)=>{
  if(!req.session.user) return res.status(401).json({error:'로그인 필요'});
  res.json({dept: req.session.currentDept || null});
});

// ===================== Socket.IO ===================== //

// 팀별 채팅
io.on("connection",(socket)=>{
  const sess = socket.handshake.session;
  const user = sess?.user;
  if(!user){ socket.disconnect(); return; }

  const dept = socket.handshake.query?.dept;
  if(!dept || !sess.currentDept || sess.currentDept!==dept){
    socket.emit("error","부서 입장 인증 필요");
    socket.disconnect(); return;
  }

  socket.join(dept);
  console.log(`✅ ${user.ID} 접속 / 방: ${dept}`);

  socket.on("chat message",(msg)=>{
    const message = {user:user.ID, role:user.role || "guest", text:msg, dept, at:Date.now()};
    io.to(dept).emit("chat message", message);
  });

  socket.on("disconnect",()=>console.log(`❌ ${user.ID} 나감 (방:${dept})`));
});

// 문의 채팅 (게스트/조합원/관리자)
const support = io.of("/support");
let supportRooms = {};

support.on("connection",(socket)=>{
  const sess = socket.handshake.session;
  const user = sess?.user;
  const role = user?.role || "guest";
  const nick = user?.ID || `Guest${Math.floor(Math.random()*9000+1000)}`;
  const roomId = role==="admin" ? "admin" : nick;

  if(role!=="admin"){
    socket.join(roomId);
    if(!supportRooms[roomId]) supportRooms[roomId]=[];
    supportRooms[roomId].forEach(msg=>socket.emit("chat message",msg));
    support.to("admin").emit("new message",{roomId,message:supportRooms[roomId].slice(-1)[0]});
  }else{
    socket.join("admin");
    socket.emit("room list", Object.keys(supportRooms));
  }

  socket.on("chat message",(msg)=>{
    if(role==="admin"){
      const { targetRoom, text } = msg;
      if(!supportRooms[targetRoom]) supportRooms[targetRoom]=[];
      const reply = {user:"관리자", role:"admin", text, at:Date.now()};
      supportRooms[targetRoom].push(reply);
      support.to(targetRoom).emit("chat message",reply);
    }else{
      const message = {user:nick, role, text:msg, at:Date.now()};
      supportRooms[roomId].push(message);
      support.to(roomId).emit("chat message",message);
      support.to("admin").emit("new message",{roomId,message});
    }
  });

  socket.on("disconnect",()=>console.log(`❌ ${nick} 나감`));
});

// ===================== 서버 실행 ===================== //
server.listen(PORT,'0.0.0.0',()=>console.log(`✅ 서버 실행: http://localhost:${PORT}`));