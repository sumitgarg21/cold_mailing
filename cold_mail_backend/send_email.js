const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const axios = require('axios');
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
app.use(express.json());
const corsOptions = {
    origin: ['http://localhost:5500', 'https://cold-mailing.vercel.app/'], // Allow only these origins
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed methods
    credentials: true, // Allow credentials (cookies, authorization headers, etc.)
};

app.use(cors(corsOptions));

const senderEmail = process.env.SENDER_EMAIL;
const senderPassword = process.env.SENDER_PASSWORD;

// app.get('/send', async (req, res) => {
//     try {
//         const doc = new GoogleSpreadsheet('12FpPguEOn4KSUL0rPl5F2Xltjq8vG0Ypo86d7GxhJ7Y', serviceAccountAuth);
//         await doc.loadInfo();
//         const sheet = doc.sheetsByIndex[0];
//         const rows = await sheet.getRows();
//         const recipientEmails = [];
//         const recipientCompanies = [];
//         const recipientSalutations = [];

//         rows.forEach((row) => {
//             if (row._rawData && row._rawData.length >= 2) {
//                 const mailId = row._rawData[0];
//                 const companyName = row._rawData[1];
//                 const salutation = row._rawData[2];
//                 const send = row._rawData[3];

//                 if (mailId && companyName && send === '1') {
//                     recipientEmails.push(mailId);
//                     recipientCompanies.push(companyName);
//                     recipientSalutations.push(salutation);
//                 }
//             }
//         });

//         const result = await sendMail(recipientEmails, recipientCompanies, recipientSalutations);
//         console.log(result);
//         res.json(result);
//     } catch (error) {
//         console.error(`${error.message}`);
//         res.status(500).json({ message: `Error: ${error.message}` });
//     }
// });

app.get('/send', async (req, res) => {
    try {
        // Fetch records from Airtable
        const response = await axios.get(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`,
            {
                headers: {
                    Authorization: `Bearer ${AIRTABLE_TOKEN}`
                }
            }
        );

        const rows = response.data.records;

        const recipientEmails = [];
        const recipientCompanies = [];
        const recipientSalutations = [];

        rows.forEach(record => {
            const fields = record.fields;
            const mailId = fields.Email;
            const companyName = fields.Company;
            const salutation = fields.Salutation;
            const send = fields.Send;

            if (mailId && companyName && send === 1) {
                recipientEmails.push(mailId);
                recipientCompanies.push(companyName);
                recipientSalutations.push(salutation);
            }
        });

        const result = await sendMail(recipientEmails, recipientCompanies, recipientSalutations);
        res.json(result);

    } 
    // catch (error) {
    //     console.error(error.message);
    //     res.status(500).json({ message: `Error: ${error.message}` });
    // }
    catch (error) {
    console.error("Airtable error:", error.response?.data || error.message);
    res.status(500).json({ message: `Error: ${error.message}` });
    }
});

async function sendMail(recipientEmails, recipientCompanies, recipientSalutations) {
    const smtpServer = 'smtp.gmail.com';
    const smtpPort = 587;

    try {
        const transporter = nodemailer.createTransport({
            pool: true,
            host: smtpServer,
            port: smtpPort,
            secure: false,
            auth: {
                user: senderEmail,
                pass: senderPassword,
            },
        });

        const emailTemplate = fs.readFileSync('email_template.html', 'utf-8');

        for (let index = 0; index < recipientEmails.length; index++) {
            const mailOptions = {
                from: senderEmail,
                to: recipientEmails[index],
                subject: `Competitive Programmer + Full Stack Developer = Perfect Fit for ${recipientCompanies[index]}`,
                html: emailTemplate
                    .replace('{company_name}', recipientCompanies[index])
                    .replace('{salutation}', recipientSalutations[index]),
            };

            await transporter.sendMail(mailOptions);
            console.log(`Email sent to ${recipientEmails[index]} for ${recipientCompanies[index]}`);
        }
        transporter.close();
        console.log('Emails sent successfully.');
        return { success: true, message: 'Emails sent successfully.' };
    } catch (error) {
        console.error(`Error sending emails: ${error.message}`);
        return { success: false, message: `Error sending emails: ${error.message}` };
    }
}


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
