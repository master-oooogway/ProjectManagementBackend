import Mailgen from "mailgen";
import sgMail from "@sendgrid/mail";
import nodemailer from "nodemailer";

const sendEmail = async (options) => {
    const mailGenerator = new Mailgen({
        theme: "default",
        product: {
            name: "ProjectCamp",
            link: "https://ssipmt.com"
        }
    })

    const emailTextual = mailGenerator.generatePlaintext(options.mailgenContent)

    const emailHtml = mailGenerator.generate(options.mailgenContent)

    // Prefer SendGrid web API (port 443/HTTPS) — always works on Render
    if (process.env.SENDGRID_API_KEY) {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);

        const msg = {
            to: options.email,
            from: process.env.EMAIL_FROM || process.env.SMTP_USER || "ProjectCamp <noreply@ssipmt.com>",
            subject: options.subject,
            text: emailTextual,
            html: emailHtml,
        };

        try {
            await sgMail.send(msg);
            return;
        } catch (err) {
            console.error("SendGrid API failed:", err.response?.body || err.message);
            throw new Error("Email delivery failed via SendGrid. Check your SENDGRID_API_KEY.");
        }
    }

    // Fallback: Use SMTP (for local development)
    const service = process.env.SMTP_SERVICE;
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = process.env.SMTP_SECURE === "true" || port === 465;

    if (!user || !pass || !host) {
        throw new Error(
            "No email provider configured. Set SENDGRID_API_KEY for SendGrid or SMTP_USER/SMTP_PASS for local SMTP."
        );
    }

    const transporterOptions = {
        auth: {
            user,
            pass,
        },
        tls: {
            rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== "false",
        },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
    };

    if (service) {
        transporterOptions.service = service;
    } else {
        transporterOptions.host = host;
        transporterOptions.port = port;
        transporterOptions.secure = secure;
    }

    const transporter = nodemailer.createTransport(transporterOptions);

    const mail = {
        from: process.env.EMAIL_FROM || process.env.SMTP_USER || "ProjectCamp <noreply@ssipmt.com>",
        to: options.email,
        subject: options.subject,
        text: emailTextual,
        html: emailHtml,
    }

    try {
        await transporter.sendMail(mail);
    } catch (err) {
        console.error("SMTP delivery failed:", err);
        throw new Error("Email delivery failed. Check SMTP configuration and credentials.");
    }
}


const emailVerificationMailgenContent = (username, otp) => {
    return {
        body: {
            name: username,
            intro: `Welcome to ProjectCamp! Use the code below to verify your email.`,
            action: {
                instructions: `Your verification code is: ${otp}`,
                button: {
                    color: "#8082ef",
                    text: "Verify Email",
                    link: `${process.env.FRONTEND_URL || "http://localhost:5173"}/verify-email-otp`
                }
            },
            outro: "This code expires in 10 minutes. If you did not create an account, please ignore this email.",
        }
    }
}

const forgotPasswordMailgenContent = (username, passwordResetUrl) => {
    return {
        body: {
            name: username, 
            intro: "We received a request to reset your ProjectCamp password.",
            action: {
                instructions: "Use the following button to choose a new password.",
                button: {
                    color: "#8082ef",
                    text: "Reset your password",
                    link: passwordResetUrl
                }
            },
            outro:
                "Need help?...reply to this email and we will help",
        }
    }
}


export {sendEmail,
    emailVerificationMailgenContent,
    forgotPasswordMailgenContent
}