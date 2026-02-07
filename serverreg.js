const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const otps = {}; // Store OTPs for emails
const verifiedEmails = []; // Store verified emails

// Configure nodemailer transporter (Gmail example)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'yourgmail@gmail.com', // your gmail
    pass: 'yourapppassword'       // app password from gmail security
  }
});

// Endpoint to send OTP email
app.post('/send-otp', (req, res) => {
  const { email } = req.body;
  if(!email) {
    return res.status(400).json({ success: false, error: 'Email required' });
  }
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otps[email] = otp;
  
  const mailOptions = {
    from: '"LibTracking" <yourgmail@gmail.com>',
    to: email,
    subject: 'Your OTP for LibTracking',
    text: `Your OTP is: ${otp}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if(error) {
      console.log(error);
      return res.json({ success: false, error: 'Failed to send OTP email' });
    }
    console.log('OTP sent:', otp);
    res.json({ success: true });
  });
});

// Endpoint to verify OTP
app.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if(otps[email] === otp){
    verifiedEmails.push(email);
    delete otps[email];
    return res.json({ success: true });
  }
  res.json({ success: false });
});

// Endpoint to login - only verified emails allowed
app.post('/login', (req, res) => {
  const { email } = req.body;
  if(verifiedEmails.includes(email)){
    return res.json({ success: true });
  }
  res.json({ success: false, message: 'Email not verified' });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
