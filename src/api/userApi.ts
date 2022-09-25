import express from "express";
import { ErrorCodes, RestfullException } from "../restfullException";
import { asyncHandler, logger } from "../common";
import { AppService } from "../service/appService";
import { User } from "../model/user";
import { Util } from "../util";
import fs from 'fs';
import { passportInit } from "./auth/passportInit";
import passport from "passport";
import { RBACDefault } from "../model/rbac";
import { config } from "process";



/////////////////////////////////  confirm //////////////////////////////////
export const routerUserEmailConfirm = express.Router();
//user/confirm
routerUserEmailConfirm.post('/', asyncHandler(async (req: any, res: any, next: any) => {
    const key = req.query.key || req.body.key;
    if (!key)
        throw new RestfullException(400, ErrorCodes.ErrBadArgument, "needs key argument");

    logger.info(`user confirm with key: ${key}`);
    const appService = req.appService as AppService;
    const configService = appService.configService;
    const redisService = appService.redisService;
    //check key from redis
    const rkey = `/user/confirm/${key}`;
    const userId = await redisService.get(rkey, false) as string;
    if (!userId) {
        logger.fatal(`user confirm key not found key: ${key}`);
        throw new RestfullException(401, ErrorCodes.ErrNotAuthorized, "not found key");
    }
    const userDb = await configService.getUserById(userId);
    if (!userDb) {//check for safety
        logger.warn(`user confirm user id not found ${userId}`);
        throw new RestfullException(401, ErrorCodes.ErrNotAuthorized, "argument problem");
    }
    //verify
    userDb.isVerified = true;
    await configService.saveUser(userDb);
    //delete the key for security
    await redisService.delete(rkey);

    logger.info(`user confirm is ok ${key}`);
    return res.status(200).json({ result: true });

}))

/////////////////////////////////// forgotpass //////////////////////////
export const routerUserForgotPassword = express.Router();

//user/forgotpass
routerUserForgotPassword.post('/', asyncHandler(async (req: any, res: any, next: any) => {
    const email = req.body.username || req.query.username;
    if (!email) {
        logger.error(`forgot password email parameter absent`);
        throw new RestfullException(400, ErrorCodes.ErrBadArgument, "needs username parameter");
    }

    const appService = req.appService as AppService;
    const configService = appService.configService;
    const redisService = appService.redisService;
    const inputService = appService.inputService;
    const templateService = appService.templateService;
    const emailService = appService.emailService;

    const isSystemConfigured = await configService.getIsConfigured();
    if (!isSystemConfigured) {
        logger.warn(`system is not configured yet`);
        throw new RestfullException(417, ErrorCodes.ErrNotConfigured, "not configured yet");
    }
    const authSettings = await configService.getAuthSettings();
    if (!authSettings.local.isForgotPassword) {
        logger.warn(`forgotpassword is not allowed`);
        throw new RestfullException(405, ErrorCodes.ErrMethodNotAllowed, "forgotpassword not enabled");
    }

    logger.info(`forgot password with email ${email}`);
    //this is security check if input is not valid email then throw exception
    await inputService.checkEmail(email);

    const userDb = await configService.getUserByUsername(email);
    if (!userDb) {

        logger.error(`forgot password no user found with email ${email}`);
        return res.status(200).json({ result: true });
    }
    /* if (userDb.source != 'local') {
        //security check only local users can forgot password
        logger.error(`forgot password user is not local with email ${email}`);
        return res.status(200).json({ result: true });
    } */
    const key = Util.createRandomHash(48);
    const link = `${req.baseHost}/user/resetpass?key=${key}`
    await redisService.set(`/user/resetpass/${key}`, userDb.id, { ttl: 7 * 24 * 60 * 60 * 1000 })//1 days

    const logoPath = (await configService.getLogo()).defaultPath || 'logo.png';
    const logo = `${req.baseHost}/dassets/img/${logoPath}`;
    const html = await templateService.createForgotPassword(userDb.name, link, logo);
    //fs.writeFileSync('/tmp/abc.html', html);
    logger.info(`forgot password sending reset link to ${userDb.username}`);
    //send reset link over email
    await emailService.send({ to: userDb.username, subject: 'Reset your password', html: html });
    return res.status(200).json({ result: true });

}))

/////////////////////////////// reset password ////////////////////////////

export const routerUserResetPassword = express.Router();


routerUserResetPassword.post('/', asyncHandler(async (req: any, res: any, next: any) => {

    const pass = req.body.pass;
    const key = req.body.key;
    if (!pass || !key) {
        logger.error(`reset password pass parameter absent or key absent`);
        throw new RestfullException(400, ErrorCodes.ErrBadArgument, "needs pass parameter");
    }



    const rkey = `/user/resetpass/${key}`;
    logger.info(`reset password with key: ${key} `)
    const appService = req.appService as AppService;
    const configService = appService.configService;
    const redisService = appService.redisService;
    const inputService = appService.inputService;
    const templateService = appService.templateService;
    const emailService = appService.emailService;

    inputService.checkPasswordPolicy(pass);

    const userId = await redisService.get(rkey, false) as string;
    if (!userId) {
        logger.fatal(`reset password key not found with id: ${key}`);
        throw new RestfullException(401, ErrorCodes.ErrNotAuthorized, "not authorized");
    }
    const user = await configService.getUserById(userId);
    if (!user) {
        logger.fatal(`reset password user not found with userId: ${userId}`);
        throw new RestfullException(401, ErrorCodes.ErrNotAuthorized, "not authorized");
    }
    inputService.checkEmail(user.username);//username must be email, security barrier

    user.password = Util.bcryptHash(pass);
    await configService.saveUser(user);
    logger.info(`reset password pass changed for ${user.username}`);
    await redisService.delete(rkey);
    return res.status(200).json({ result: true });

}))


//////////////////////////////// authenticated user /////////////////////
/////////////////////////////// current user ////////////////////////////

export const routerUserAuthenticated = express.Router();

routerUserAuthenticated.get('/current',
    asyncHandler(passportInit),
    passport.authenticate(['jwt', 'headerapikey'], { session: false, }),
    asyncHandler(async (req: any, res: any, next: any) => {
        const appService = req.appService as AppService;
        const configService = appService.configService;
        const user = req.currentUser as User;

        const roles = await configService.getUserRoles(user);
        //send min data for security
        return res.status(200).json(
            {
                id: user.id,
                name: user.name,
                username: user.username,
                is2FA: user.is2FA,
                roles: roles
            });
    })
);


