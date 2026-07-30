const nodemailer = require("nodemailer");
const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const dns = require("dns");
const dnsPromises = require("node:dns/promises");

dnsPromises.setServers(["1.1.1.1", "8.8.8.8"]);
dns.setDefaultResultOrder("ipv4first");

console.log(process.env.MAIL_USER);
console.log(process.env.MAIL_PASS);

const { getAmbassadorEmailTemplate } = require("../confiq/ambassadorMail");

const emails = [
  "ositanwaubani@gmail.com",
  "ugdave111@gmail.com",
  "harrisonpaul199@gmail.com",
  "zulatopmiga@gmail.com",
  "fatonamercy45@gmail.com",
  "melchizedeckuwa32@gmail.com",
  "asahiharu620@gmail.com",
  "wisetech026@gmail.com",
  "snowcliks2@gmail.com",
  "ibrahimauwal8200@gmail.com",
  "mlook4732@gmail.com",
  "naphtalionukogu@gmail.com",
  "philipogunwole261@gmail.com",
  "thatswhyumar@gmail.com",
  "eniisaiah543@gmail.com",
  "francisvictor66@gmail.com",
  "williamsjoseph39774@gmail.com",
  "owosanyaabraham@gmail.com",
  "bilalliasu847@gmail.com",
  "olupekaayodeji5@gmail.com",
  "sobowalehamzat@gmail.com",
  "kiraknight222@gmail.com",
  "godspoweromega@gmail.com",
  "patiseh4@gmail.com",
  "emedesophisticatedguy@gmail.com"
];

const sendAmbassadorEmails = async () => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    console.log(`📨 Sending to ${emails.length} ambassadors...`);

    let sentCount = 0;

    for (const email of emails) {
      try {
        await transporter.sendMail({
          from: `"AxioMarket" <${process.env.MAIL_USER}>`,
          to: email,
          subject: "Welcome to the Next Stage of the AxioMarket Ambassador Program 🚀",
          html: getAmbassadorEmailTemplate(),
          attachments: [
            {
              filename: "logo.png",
              path: path.join(__dirname, "../assets/logo.png"),
              cid: "logo",
            },
          ],
        });

        sentCount++;

        console.log(
          `✅ [${sentCount}/${emails.length}] Sent successfully: ${email}`
        );

        // Optional: small delay to reduce Gmail rate-limit risk
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (err) {
        console.error(`❌ Failed: ${email}`);
        console.error(err.message);
      }
    }

    console.log(`🎉 DONE! Total sent: ${sentCount}/${emails.length}`);
  } catch (error) {
    console.error("❌ Error:", error);
  }
};

// sendAmbassadorEmails();