import Mailgen from "mailgen";
import nodemailer from "nodemailer";

const sendEmail = async (options) => {
    const mailGenerator = new Mailgen({
        theme: "default",
        product: {
            name: "Task Manager",
            link: "https://taskmanagelink.com"
        }
    })

    const emailTextual = mailGenerator.generatePlaintext(options.mailgenContent)

    const emailHtml = mailGenerator.generate(options.mailgenContent)

    const service = process.env.SMTP_SERVICE;
    const host = process.env.SMTP_HOST || (service === "gmail" ? "smtp.gmail.com" : process.env.MAILTRAP_SMTP_HOST);
    const port = Number(process.env.SMTP_PORT || process.env.MAILTRAP_SMTP_PORT || 587);
    const user = process.env.SMTP_USER || process.env.MAILTRAP_SMTP_USER;
    const pass = process.env.SMTP_PASS || process.env.MAILTRAP_SMTP_PASS;
    const secure = process.env.SMTP_SECURE === "true" || port === 465;

    if (!user || !pass || !host) {
        throw new Error(
            "SMTP is not configured correctly. Set SMTP_USER and SMTP_PASS for Gmail or MAILTRAP_SMTP_USER and MAILTRAP_SMTP_PASS for Mailtrap."
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
    };

    if (service) {
        transporterOptions.service = service;
    }

    transporterOptions.host = host;
    transporterOptions.port = port;
    transporterOptions.secure = secure;

    const transporter = nodemailer.createTransport(transporterOptions);

    const mail = {
        from: process.env.EMAIL_FROM || process.env.SMTP_USER || "ProjectCamp <no-reply@projectcamp.com>",
        to: options.email,
        subject: options.subject,
        text: emailTextual,
        html: emailHtml,
    }

    try {
        await transporter.verify();
        await transporter.sendMail(mail);
    } catch (err) {
        console.error("Email service failed:", err);
        throw new Error("Email delivery failed. Check SMTP configuration and credentials.");
    }
}


const emailVerificationMailgenContent = (username, otp) => {
    return {
        body: {
            name: username,
            intro: `Welcome to ProjectCamp! Your verification code is ${otp}.`,
            action: {
                instructions: "Enter this code in the ProjectCamp verification screen. It expires in 10 minutes."
            },
            outro: "If you did not create an account, please ignore this email.",
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
