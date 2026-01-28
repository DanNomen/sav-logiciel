const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

const users = [
  { email: 'test@example.com', password: '123456' }
];


app.post('/api/login', (req, res) => {
  console.log('BODY:', req.body);

  if (!req.body) {
    return res.status(400).json({ message: 'Body is missing' });
  }

  const { email, password } = req.body;

  const user = users.find(
    u => u.email === email && u.password === password
  );

  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  return res.json({
    token: 'abcd1234',
    message: 'Login successful'
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
