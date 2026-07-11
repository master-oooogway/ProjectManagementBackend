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

    // to send mail
    const transporter = nodemailer.createTransport({
        host: process.env.MAILTRAP_SMTP_HOST,
        port: process.env.MAILTRAP_SMTP_PORT,
        auth: {
            user: process.env.MAILTRAP_SMTP_USER,
            pass: process.env.MAILTRAP_SMTP_PASS,
        },
    })

    const mail = {
        from: "mail.taskmanager@example.com",
        to: options.email,
        subject: options.subject,
        text: emailTextual,
        html: emailHtml
    }


    try{
        await transporter.sendMail(mail)
    }catch(err){
        console.error("Email service failed siliently, make sure that you have provided the mailtrap credentials correct!");
        
    }

}


const emailVerificationMailgenContent = (username, verificationUrl) => {
    return {
        body: {
            name: username, 
            intro: "Welcome to our App!",
            action: {
                instructions: "To verfiy your email please click on the following button",
                button: {
                    color: "#772936",
                    text: "Verify your email",
                    link: verificationUrl
                }
            },
            outro:
                "Need help?...reply to this email and we will help",
        }
    }
}

const forgotPasswordMailgenContent = (username, passwordResetUrl) => {
    return {
        body: {
            name: username, 
            intro: "Request to reset password",
            action: {
                instructions: "To reset your email please click on the following button",
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