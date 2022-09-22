
import passport from 'passport';
import passportlocal from 'passport-local';
import passportlinkedin from 'passport-linkedin-oauth2';
import { AuthSettings } from '../../model/authSettings';
import { logger } from '../../common';
import { AppService } from '../../service/appService';
import { User } from '../../model/user';
import { Util } from '../../util';
import { HelperService } from '../../service/helperService';

export function linkedinInit(auth: AuthSettings, url: string) {
    passport.use(new passportlinkedin.Strategy({
        clientID: auth.linkedin?.clientID || '',
        clientSecret: auth.linkedin?.clientSecret || '',
        callbackURL: `${url}/login/callback/google`,
        passReqToCallback: true,
        scope: ['r_emailaddress', 'r_liteprofile'],
    },
        async (req: any, accessToken: any, refreshToken: any, profile: any, done: any) => {
            try {
                const email = profile.emails[0];
                const name = profile.displayName;
                logger.info(`passport linkedin with email: ${email}`);
                const appService = req.appService as AppService;
                const configService = appService.configService;
                const redisService = appService.redisService;

                let user = await configService.getUserByUsername(email);
                if (!user) {
                    let userSave: User = HelperService.createUser('linkedin', email, name, '');
                    userSave.isVerified = true;
                    await configService.saveUser(userSave);

                }
                //set user to request object
                req.currentUser = user;
                return done(null, user);

            } catch (err) {
                return done(err);
            }
        }
    ));
}