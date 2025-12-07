const nodemailer = require('nodemailer');
const logger = require('./logger');

// Create reusable transporter object using the default SMTP transport
const createTransporter = async () => {
  // If EMAIL_USER and EMAIL_PASS are provided, use Gmail
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    logger.info('Using Gmail SMTP for sending emails');
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  } else {
    // Fallback to Ethereal test account for development
    logger.info('Using Ethereal test account for sending emails');
    let testAccount = await nodemailer.createTestAccount();

    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }
};

// Template variable substitution
const replaceTemplateVars = (template, vars) => {
  let result = template;
  Object.keys(vars).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, vars[key] || '');
  });
  return result;
};

// Get email templates from environment or use defaults
const getEmailTemplate = (type, vars) => {
  const fromName = process.env.EMAIL_FROM_NAME || 'BloodLink';
  // Use actual Gmail address if provided, otherwise use default
  const fromAddress = process.env.EMAIL_USER || process.env.EMAIL_FROM_ADDRESS || 'no-reply@bloodlink.com';
  
  const templates = {
    blood_request: {
      subject: process.env.EMAIL_BLOOD_REQUEST_SUBJECT || 'Blood Request: {{bloodType}} Needed',
      text: process.env.EMAIL_BLOOD_REQUEST_TEXT || `Hello {{donorName}},

A new blood request has been posted near {{location}} for blood type {{bloodType}}.
Patient Name: {{patientName}}

You can help save a life by accepting this request.

Accept Request: {{acceptLink}}

Thank you for being a donor!

Best regards,
${fromName}`,
      html: process.env.EMAIL_BLOOD_REQUEST_HTML || `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .button { display: inline-block; background-color: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🩸 Blood Request Alert</h1>
    </div>
    <div class="content">
      <p>Hello <strong>{{donorName}}</strong>,</p>
      <p>A new blood request has been posted that matches your blood type!</p>
      <p><strong>Blood Type Needed:</strong> {{bloodType}}</p>
      <p><strong>Patient Name:</strong> {{patientName}}</p>
      <p><strong>Location:</strong> {{location}}</p>
      <p>Your donation can save a life. Please consider accepting this request if you are available.</p>
      <div style="text-align: center;">
        <a href="{{acceptLink}}" class="button">Accept Request</a>
      </div>
      <p style="font-size: 12px; color: #6b7280;">If the button doesn't work, copy and paste this link: {{acceptLink}}</p>
    </div>
    <div class="footer">
      <p>Thank you for being a registered donor with ${fromName}</p>
      <p>This is an automated message, please do not reply.</p>
    </div>
  </div>
</body>
</html>
`
    },
    otp_verification: {
      subject: 'Verify Your Email - BloodLink',
      text: `Hello {{name}},\n\nYour verification code is: {{otp}}\n\nThis code will expire in 10 minutes.\n\nBest regards,\n${fromName}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Verify Your Email</h2>
          <p>Hello <strong>{{name}}</strong>,</p>
          <p>Your verification code is:</p>
          <h1 style="color: #dc2626; letter-spacing: 5px;">{{otp}}</h1>
          <p>This code will expire in 10 minutes.</p>
        </div>
      `
    }
  };

  const template = templates[type] || templates.blood_request;
  
  return {
    from: `"${fromName}" <${fromAddress}>`,
    subject: replaceTemplateVars(template.subject, vars),
    text: replaceTemplateVars(template.text, vars),
    html: replaceTemplateVars(template.html, vars),
  };
};

const sendEmail = async ({ to, subject, text, html, template, templateVars }) => {
  try {
    const transporter = await createTransporter();

    let mailOptions;
    
    // If template is specified, use template system
    if (template && templateVars) {
      const templateData = getEmailTemplate(template, templateVars);
      mailOptions = {
        from: templateData.from,
        to,
        subject: templateData.subject,
        text: templateData.text,
        html: templateData.html,
      };
    } else {
      // Legacy support: direct subject/text/html
      const fromName = process.env.EMAIL_FROM_NAME || 'BloodLink';
      const fromAddress = process.env.EMAIL_USER || process.env.EMAIL_FROM_ADDRESS || 'no-reply@bloodlink.com';
      mailOptions = {
        from: `"${fromName}" <${fromAddress}>`,
        to,
        subject,
        text,
        html,
      };
    }

    const info = await transporter.sendMail(mailOptions);

    logger.info(`Email sent successfully to ${to} - Message ID: ${info.messageId}`);
    
    // Preview URL only available when using Ethereal (test account)
    if (!process.env.EMAIL_USER) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          logger.info(`Preview URL: ${previewUrl}`);
          console.log(`Preview URL: ${previewUrl}`);
        }
    } else {
        logger.info(`Real email sent via Gmail to ${to}`);
    }
    
    return info;
  } catch (error) {
    logger.error(`Error sending email to ${to}: ${error.message}`);
    throw error;
  }
};

module.exports = sendEmail;


