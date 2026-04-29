const nodemailer = require("nodemailer");
const path = require("path");
const mongoose = require("mongoose");
const Ambassador = require("../models/Ambassador");
const { getAmbassadorEmailTemplate } = require("../confiq/ambassadorMail");


const dns = require("dns");
const dnsPromises = require("node:dns/promises");


require("dotenv").config({
    path: path.resolve(__dirname, "../.env"),
});

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ MongoDB connected");
    } catch (err) {
        console.error("❌ MongoDB connection failed:", err);
        process.exit(1);
    }
};


dnsPromises.setServers(["1.1.1.1", "8.8.8.8"]);
dns.setDefaultResultOrder("ipv4first");


const sendAmbassadorEmails = async () => {
    try {
        await connectDB();

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS,
            },
        });

        // ✅ ONLY PEOPLE NOT SENT YET
        const ambassadors = await Ambassador.find({
            $or: [
                { isEmailSent: false },
                { isEmailSent: { $exists: false } }
            ]
        });

        console.log("📨 To send:", ambassadors.length);

        let sentCount = 0;

        for (const ambassador of ambassadors) {
            const email = ambassador.email;

            if (!email) continue;

            try {
                await transporter.sendMail({
                    from: `"AxioMarket" <${process.env.MAIL_USER}>`,
                    to: email,
                    subject: "Welcome to AxioMarket Ambassador Program 🚀",
                    html: getAmbassadorEmailTemplate(),
                    attachments: [
                        {
                            filename: "logo.png",
                            path: path.join(__dirname, "../assets/logo.png"),
                            cid: "logo",
                        },
                    ],
                });

                // ✅ mark as sent
                await Ambassador.updateOne(
                    { _id: ambassador._id },
                    { $set: { isEmailSent: true } }
                );

                sentCount++;
                console.log(`✅ Sent + updated: ${email}`);
            } catch (err) {
                console.log(`❌ Failed: ${email}`, err.message);
            }
        }

        console.log(`🎉 DONE. Total sent: ${sentCount}`);
    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await mongoose.disconnect();
    }
};

sendAmbassadorEmails();