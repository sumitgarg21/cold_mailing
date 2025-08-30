//loading dependencies
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const axios = require('axios');

//loading environment variables from .env file
dotenv.config();

//accessing environment variables
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;

const senderEmail = process.env.SENDER_EMAIL;
const senderPassword = process.env.SENDER_PASSWORD;

//setting up express server
const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());

const corsOptions = {
    origin: ['http://127.0.0.1:5500', 'https://cold-mailing.vercel.app/'], // Allow only these origins
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed methods
    credentials: true, // Allow credentials (cookies, authorization headers, etc.)
};

app.use(cors(corsOptions));

app.get('/send', async (req, res) => {
    try {
        // Fetch records from Airtable
        const response = await axios.get(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`,
            {
                headers: {
                    Authorization: `Bearer ${AIRTABLE_TOKEN}`,
                },
            }
        );

        const rows = response.data.records;
        const recipients = rows
            .filter(r => r.fields.Email && r.fields.Company && r.fields.Send === 1)
            .map(r => ({
                email: r.fields.Email,
                company: r.fields.Company,
                salutation: r.fields.Salutation || '',
            }));

        if (recipients.length === 0) {
            return res.json({ success: false, message: 'No recipients found to send.' });
        }

        const result = await sendMail(recipients);
        res.json(result);

    } catch (error) {
        console.error("Airtable error:", error.response?.data || error.message);
        res.status(500).json({ message: `Error: ${error.message}` });
    }
});

// ==== Send Emails ====
async function sendMail(recipients) {
    try {
        const transporter = nodemailer.createTransport({
            pool: true,
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: senderEmail,
                pass: senderPassword,
            },
        });

        const emailTemplate = fs.readFileSync('email_template.html', 'utf-8');

        // Send all emails concurrently
        const results = await Promise.allSettled(
            recipients.map(r => {
                const mailOptions = {
                    from: senderEmail,
                    to: r.email,
                    subject: `Competitive Programmer + Full Stack Developer = Perfect Fit for ${r.company}`,
                    html: emailTemplate
                        .replace('{company_name}', r.company)
                        .replace('{salutation}', r.salutation),
                };
                return transporter.sendMail(mailOptions);
            })
        );

        // Summarize results
        const successes = results.filter(r => r.status === 'fulfilled').length;
        const failures = results.filter(r => r.status === 'rejected');

        failures.forEach(f => console.error(`❌ Failed: ${f.reason.message}`));
        console.log(`✅ Successful: ${successes}`);
        return {
            success: failures.length === 0,
            message: `Sent ${successes}/${recipients.length} emails`,
            failed: failures.length,
        };

    } catch (error) {
        console.error(`Error sending emails: ${error.message}`);
        return { success: false, message: `Error sending emails: ${error.message}` };
    }
}


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
