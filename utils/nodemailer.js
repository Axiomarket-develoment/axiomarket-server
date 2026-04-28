const nodemailer = require("nodemailer");
require("dotenv").config();
const path = require('path'); // add this at the top



const transport = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    },

    tls: {
        rejectUnauthorized: false
    }
});


const sendOTP = async (email, otp) => {
    try {
        const info = await transport.sendMail({

            from: `Backend Team <${process.env.MAIL_USER}>`,
            to: email,
            subject: "One Time Password",
            html: `<p style="line-height: 1.5">
        Your OTP verification code is: <br /> <br />
        <font size="3px">${otp}</font> <br />
        Please note that this otp will be valid for 5 minutes
        Best regards,<br />
        The Backend Team.
        </p>
        </div>`,
        });

        console.log("Email sent:", info.response);
    } catch (error) {
        console.error("Error sending email:", error);
        return { msg: "Error sending email", error };
    }
};
// const path = require("path");

const sendSuccessMessage = async (email, name, groupLink) => {
    console.log(email, name, groupLink);

    try {
        const info = await transport.sendMail({
            from: `BlockHub Team <${process.env.MAIL_USER}>`,
            to: email,
            subject: "You're In! Welcome to BlockHub 🎉",
            text: `Hi ${name || "dear"},\n\nThanks for completing your purchase. We’ll follow up shortly with access details.\n\n— BlockHub Team`,
            html: `
        <p>Hi ${name},</p>
        <p>Welcome to BlockHub! We’re excited to have you onboard.</p>
        <p>Your purchase was successful. Expect your access materials within the next 24 hours.</p>
        <p>If you have any questions, feel free to reply directly to this email.</p>
        <p>— The BlockHub Team</p>

        <p>To keep things seamless, we’re moving all paid users into one WhatsApp group. That way, you'll never miss an update, resource, or next step.</p>

        <p><strong>Tap here to join:</strong> <a href="${groupLink}">${groupLink}</a></p>

        <hr/>
        <p><strong>📘 Attached PDF:</strong> "BlockHub Done-For-You Guide"</p>
        <p>Please go through this guide before contacting support — it contains all setup steps and resource links.</p>
      `,
            attachments: [
                {
                    filename: "BlockHub-Done-For-You-Guide.pdf",
                    path: path.join(__dirname, "docs", "BlockHub-Done-For-You-Guide.pdf"),
                    contentType: "application/pdf",
                },
            ],
        });

        console.log("✅ Email sent:", info.response);
    } catch (error) {
        console.error("❌ Error sending email:", error);
        return { msg: "Error sending email", error };
    }
};

const sendWhatsappInvite = async (email, name, groupLink) => {

    console.log(email, name, groupLink);

    try {
        const info = await transport.sendMail({
            from: `BlockHub Team <${process.env.MAIL_USER}>`,
            to: email,
            subject: "You're Invited: Join the BlockHub Portfolio Community on WhatsApp",
            html: `
             <p>Hey ${name || 'there'},</p>

<p>You’ve officially unlocked access to the BlockHub Portfolio Toolkit 🎉</p>
<p>To keep things seamless, we’re moving all paid users into one WhatsApp group. That way, you'll never miss an update, resource, or next step.</p>

<p><strong>Tap here to join:</strong> <a href="${groupLink}">${groupLink}</a></p>

<p>Welcome on board.<br />– BlockHub Team</p>         `
        });

        console.log("WhatsApp invite sent:", info.response);
    } catch (error) {
        console.error("Error sending WhatsApp invite:", error);
        return { msg: "Error sending invite", error };
    }
};


const sendPortfolioEmail = async (email, name, portfolioLink, portfolioPdfPath) => {
    try {
        const info = await transport.sendMail({
            from: `BlockHub Team <${process.env.MAIL_USER}>`,
            to: email,
            subject: "Your BlockHub Portfolio & Editable Link",
            html: `
        <p>Hi ${name || 'there'},</p>
        <p>We’re excited to share your BlockHub portfolio with you.</p>
        <p>You can <strong>edit your portfolio here</strong> using Canva:</p>
        <p><a href="${portfolioLink}" target="_blank" rel="noopener noreferrer">${portfolioLink}</a></p>
       <p>Also, a PDF is attached to this email. This PDF contains important information to help you start your Web3 journey through the app.</p>
  <p>If you have any questions, feel free to reply to this email.</p>
        <p>Best regards,<br/>BlockHub Team</p>
      `,
            attachments: [{
                filename: path.basename(portfolioPdfPath),
                path: portfolioPdfPath,
                contentType: 'application/pdf',
            },],
        });

        console.log("Portfolio email sent:", info.response);
    } catch (error) {
        console.error("Error sending portfolio email:", error);
        return { msg: "Error sending portfolio email", error };
    }
};


// const sendAcademyThankYou = async (email, name) => {
//     try {
//         const info = await transport.sendMail({
//             from: `BlockHub Academy <${process.env.MAIL_USER}>`,
//             to: email,
//             subject: "Welcome to BlockHub Academy 🎉",
//             html: `
//         <p>Hi ${name || 'there'},</p>
        
//         <p>Thank you for registering with <strong>BlockHub Academy</strong>! 🚀</p>
        
//         <p>We’re excited to have you onboard and can’t wait to support your Web3 learning journey.</p>
        
//         <p>Next steps: our team will review your details and get in touch soon with more resources and onboarding information.</p>
        
//         <p>If you have any questions, feel free to reply directly to this email.</p>
        
//         <p>Best regards,<br/>The BlockHub Academy Team</p>
//       `,
//         })

//         console.log("Thank-you email sent:", info.response)
//     } catch (error) {
//         console.error("Error sending thank-you email:", error)
//         return { msg: "Error sending thank-you email", error }
//     }
// }


const sendAcademyThankYou = async (email, name, courses = []) => {
  try {
    const courseList = courses.length
      ? `<ul>${courses.map(course => `<li>${course}</li>`).join('')}</ul>`
      : '<p>No specific courses selected.</p>';

    const info = await transport.sendMail({
      from: `BlockHub Academy <${process.env.MAIL_USER}>`,
      to: email,
      subject: "Welcome to BlockHub Academy 🎉",
      html: `
        <p>Hi ${name || 'there'},</p>
        
        <p>Thank you for registering with <strong>BlockHub Academy</strong>! 🚀</p>
        
        <p>You’ve shown interest in the following courses/skills:</p>
        ${courseList}

        <p>We’re excited to announce that our official academy launch is on <strong>5th January</strong>! 🗓️</p>
        
        <p>Next steps: our team will review your details and get in touch soon with more resources and onboarding information.</p>
        
        <p>If you have any questions, feel free to reply directly to this email.</p>
        
        <p>Best regards,<br/>The BlockHub Academy Team</p>
      `,
    });

    console.log("Thank-you email sent:", info.response);
  } catch (error) {
    console.error("Error sending thank-you email:", error);
    return { msg: "Error sending thank-you email", error };
  }
};



module.exports = { sendOTP, sendAcademyThankYou, sendSuccessMessage, sendWhatsappInvite, sendPortfolioEmail }