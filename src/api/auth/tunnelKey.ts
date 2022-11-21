
import passport from 'passport';
import * as passportapikey from 'passport-headerapikey';
import { logger } from '../../common';
import { AppService } from '../../service/appService';
import { ErrorCodes, RestfullException } from '../../restfullException';
import { HelperService } from '../../service/helperService';
import { Tunnel } from '../../model/tunnel';
import passportCustom from 'passport-custom';
import { attachActivitySource, attachActivityUser, attachActivityUsername, saveActivity, saveActivityError } from './commonAuth';
import { ActivityLog } from '../../model/activityLog';

const name = 'headertunnelkey';
export function tunnelKeyInit() {
    passport.use(name, new passportCustom.Strategy(
        async (req: any, done: any) => {

            try {

                attachActivitySource(req, name);
                let tunnelkey = req.get('TunnelKey') as string;
                if (!tunnelkey)
                    throw new RestfullException(401, ErrorCodes.ErrTunnelKeyIsNotValid, 'tunnel key header not found');
                attachActivityUsername(req, tunnelkey);
                logger.info(`passport with tunnelkey: ${tunnelkey}`);
                const appService = req.appService as AppService;
                const configService = appService.configService;
                const redisService = appService.redisService;
                const tunnelService = appService.tunnelService;
                const sessionService = appService.sessionService;

                if (!tunnelkey)
                    throw new RestfullException(400, ErrorCodes.ErrBadArgument, "bad argument");
                const tunnel = await tunnelService.getTunnel(tunnelkey);

                await HelperService.isValidTunnel(tunnel);

                const currentSession = await sessionService.getSession(tunnel?.sessionId || '0');
                req.currentSession = currentSession;



                //set user to request object
                const user = await configService.getUserById(tunnel?.userId || '0');
                attachActivityUser(req, user);
                HelperService.isValidUser(user);
                req.currentUser = user;
                req.currentTunnel = tunnel;


                // TODO  we need a session
                if (!currentSession && user) {
                    req.currentSession = await sessionService.createFakeSession(user, false, req.clientIp, name);
                }

                await saveActivity(req, 'login try', (act: ActivityLog) => {
                    act.assignedIp = tunnel?.assignedClientIp;
                    act.tunnelId = tunnel?.id;
                    act.is2FA = tunnel?.is2FA;
                    act.gatewayId = tunnel?.gatewayId
                    act.serviceId = tunnel?.sessionId;
                    act.trackId = tunnel?.trackId;
                    act.tun = tunnel?.tun;

                });
                return done(null, user);

            } catch (err) {
                await saveActivityError(req, 'login try', err);
                return done(null, null, err);
            }

        }
    ));
    return name;
}
export function tunnelKeyUnuse() {
    passport.unuse(name)
}