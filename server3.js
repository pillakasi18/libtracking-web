const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const otpGenerator = require('otp-generator');
require('dotenv').config();

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(__dirname));

// Serve registration form
app.get('/register', (req, res) => {
  res.sendFile(__dirname + '/register.html');
});

// Handle OTP request
app.post('/send-otp', async (req, res) => {
  const { emailOrPhone } = req.body;
  if (!emailOrPhone) return res.send('Email or phone required!');

  // Generate a 6-digit OTP
  const otp = otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false });

  // Send OTP via Email
  try {
    let transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: emailOrPhone,
      subject: 'Your OTP Code',
      text: `Your OTP code is ${otp}`
    });

    res.send('OTP sent to your email!');
  } catch (err) {
    console.error(err);
    res.send('Failed to send OTP. Check email address.');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
