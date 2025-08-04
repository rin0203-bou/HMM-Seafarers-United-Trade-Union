const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 데이터 파일 경로
const usersFile = path.join(__dirname, 'users.json');
const postsFile = path.join(__dirname, 'posts.json');

// 파일 없을 경우 초기화
if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, JSON.stringify([], null, 2));
if (!fs.existsSync(postsFile)) fs.writeFileSync(postsFile, JSON.stringify([], null, 2));

// 미들웨어 설정
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname)); // 이미지 파일도 접근 가능하게

// 세션 설정
app.use(session({
  secret: 'my-secret',
  resave: false,
  saveUninitialized: true
}));

// ✅ 회원가입
app.post('/signup', (req, res) => {
  const { ID, password, email } = req.body;
  const users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));

  if (users.find(user => user.ID === ID)) {
    return res.send('<h3>이미 존재하는 아이디입니다.</h3><a href="/signup.html">돌아가기</a>');
  }

  users.push({ ID, password, email, role: 'user' });
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  res.send('<h2>🎉 회원가입이 완료되었습니다!</h2><a href="/login.html">로그인하기</a>');
});

// ✅ 로그인
app.post('/login', (req, res) => {
  const { ID, password } = req.body;
  const users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
  const user = users.find(u => u.ID === ID && u.password === password);

  if (!user) {
    return res.send('<h3>아이디 또는 비밀번호가 틀렸습니다 😢</h3><a href="/login.html">돌아가기</a>');
  }

  req.session.user = user;
  res.redirect('/member.html');
});

// ✅ 아이디 찾기
app.post('/find_id', (req, res) => {
  const { email } = req.body;
  const users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
  const user = users.find(u => u.email === email);

  if (user) {
    res.send(`<h2>🔎 아이디 찾기 결과</h2><p>아이디는 <strong>${user.ID}</strong> 입니다.</p><a href="/login.html">로그인 하러가기</a>`);
  } else {
    res.send('<h2>🔎 아이디 찾기 결과</h2><p>해당 이메일로 가입된 아이디를 찾을 수 없습니다 😢</p><a href="/find_id.html">다시 시도하기</a>');
  }
});

// ✅ 비밀번호 찾기
app.post('/find_pw', (req, res) => {
  const { email } = req.body;
  const users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
  const user = users.find(u => u.email === email);

  if (user) {
    res.send(`<h2>🔐 비밀번호 찾기 결과</h2><p>${user.email}로 가입된 계정의 비밀번호는 <strong>${user.password}</strong> 입니다.</p><a href="/login.html">로그인 하러가기</a>`);
  } else {
    res.send('<h2>🔐 비밀번호 찾기 결과</h2><p>해당 이메일로 가입된 비밀번호를 찾을 수 없습니다 😢</p><a href="/find_pw.html">다시 시도하기</a>');
  }
});

// ✅ 게시글 작성
app.post('/post', (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(401).send('로그인 필요');

  const { title, content } = req.body;
  const isPrivate = req.body.private === 'on';

  const posts = JSON.parse(fs.readFileSync(postsFile, 'utf8'));
  posts.unshift({
    author: user.ID,
    title,
    content,
    private: isPrivate
  });

  fs.writeFileSync(postsFile, JSON.stringify(posts, null, 2));
  res.send('작성 완료');
});

// ✅ 게시글 목록 조회
app.get('/posts', (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(401).send('로그인 필요');

  const posts = JSON.parse(fs.readFileSync(postsFile, 'utf8'));
  const filteredPosts = posts.filter(post => !post.private || post.author === user.ID || user.role === 'admin');

  res.json(filteredPosts);
});

// ✅ 현재 로그인된 사용자 정보
app.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: '로그인 필요' });
  res.json(req.session.user);
});

// ✅ 조합원 목록
app.get('/members', (req, res) => {
  if (!req.session.user) return res.status(401).send('로그인 필요');
  const users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
  res.json(users);
});

// ✅ 기본 경로
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// ✅ 서버 실행
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
});