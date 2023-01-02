import { ErrorCodes, ErrorCodesInternal, RestfullException } from "../restfullException";
import { User } from "../model/user";
import { ConfigService } from "./configService";
import { TunnelService } from "./tunnelService";
import { AuditService } from "./auditService";
import { RedisService } from "../service/redisService";
import { Tunnel } from "../model/tunnel";
import { AuthenticationRule } from "../model/authenticationPolicy";
import { AuthorizationRule } from "../model/authorizationPolicy";
import ip from 'ip-cidr';
import { HelperService } from "./helperService";
import { logger } from "../common";
import { Network } from "../model/network";


export interface UserNetworkListResponse {
    network: Network,
    action: 'deny' | 'allow',
    needs2FA?: boolean,
    needsIp?: boolean,
    needsGateway?: boolean;

}


export interface PolicyAuthzResult {

    error: number, index?: number, rule?: AuthorizationRule
}

export class PolicyService {
    /**
     *
     */
    constructor(private configService: ConfigService,
    ) {


    }

    async checkUserIdOrGroupId(rule: AuthenticationRule | AuthorizationRule, user: User) {
        if (!rule.userOrgroupIds.length) return true;

        if (rule.userOrgroupIds.includes(user.id))
            return true;
        if (rule.userOrgroupIds.find(x => user.groupIds.includes(x)))
            return true;

        return false;

    }
    async check2FA(rule: AuthenticationRule | AuthorizationRule, checkValue: boolean) {
        if (!rule.profile.is2FA) return true
        else
            if (checkValue) return true;
            else
                return false;

    }
    async checkIps(rule: AuthenticationRule, clientIp: string) {
        if (!rule.profile.ips?.length) return true;
        const client = ip.createAddress(clientIp);
        for (const ipprofile of rule.profile.ips) {

            if (client.isInSubnet(ip.createAddress(ipprofile.ip)))
                return true;
        }
        return false;

    }
    errorNumber = 0;
    // TODO  make this errors  most meaning full
    async authenticate(user: User, is2FAValidated: boolean, tunnel: Tunnel | undefined) {
        //get tunnel basic information
        this.errorNumber = 0;
        //const tunnel = await this.tunnelService.getTunnel(tunnelKey);
        if (!tunnel || !tunnel.id || !tunnel.clientIp || !tunnel.gatewayId) {
            this.errorNumber = 1;

            throw new RestfullException(401, ErrorCodes.ErrTunnelFailed, ErrorCodesInternal.ErrTunnelNotFoundOrNotValid, 'secure tunnel failed');
        }

        const gateway = await this.configService.getGateway(tunnel.gatewayId);
        if (!gateway) {
            this.errorNumber = 2;

            throw new RestfullException(401, ErrorCodes.ErrBadArgument, ErrorCodesInternal.ErrGatewayNotFound, 'no gateway');
        }
        if (!gateway.isEnabled) {
            this.errorNumber = 3;

            throw new RestfullException(401, ErrorCodes.ErrBadArgument, ErrorCodesInternal.ErrGatewayNotValid, 'no gateway');
        }
        const network = await this.configService.getNetwork(gateway.networkId || '');
        if (!network) {
            this.errorNumber = 4;

            throw new RestfullException(401, ErrorCodes.ErrBadArgument, ErrorCodesInternal.ErrNetworkNotFound, 'no network');
        }

        if (!network.isEnabled) {
            this.errorNumber = 5;

            throw new RestfullException(401, ErrorCodes.ErrBadArgument, ErrorCodesInternal.ErrNetworkNotValid, 'no network');
        }
        const policy = await this.configService.getAuthenticationPolicy();
        const rules = await policy.rules.filter(x => x.networkId == network.id);
        for (const rule of rules) {
            if (!rule.isEnabled)
                continue;
            let f1 = await this.checkUserIdOrGroupId(rule, user);
            let f2 = await this.check2FA(rule, is2FAValidated);
            let f3 = await this.checkIps(rule, tunnel.clientIp);
            if (f1 && f2 && f3) {
                if (rule.action == 'allow') {
                    return rule;
                }
                else {
                    this.errorNumber = 10;
                    throw new RestfullException(401, ErrorCodes.ErrNotAuthenticated, ErrorCodesInternal.ErrRuleDenyMatch, 'not authenticated');
                }

            }

        }
        //no rule match
        this.errorNumber = 100;

        throw new RestfullException(401, ErrorCodes.ErrNotAuthenticated, ErrorCodesInternal.ErrNoRuleMatch, 'not authenticated');
    }

    /**
     * @summary find networks that user can connect or why not connect
     * @returns 
     */
    async userNetworks(user: User, is2FAValidated: boolean, clientIp: string) {

        this.errorNumber = 0;
        let result: UserNetworkListResponse[] = [];

        const networks = await this.configService.getNetworksAll();
        const policy = await this.configService.getAuthenticationPolicy();
        for (const network of networks) {


            if (!network) {
                this.errorNumber = 1;
                continue;
            }

            if (!network.isEnabled) {
                this.errorNumber = 5;
                continue;
            }


            const rules = await policy.rules.filter(x => x.networkId == network.id);
            for (const rule of rules) {
                if (!rule.isEnabled)
                    continue;
                let f1 = await this.checkUserIdOrGroupId(rule, user);
                let f2 = await this.check2FA(rule, is2FAValidated);
                let f3 = await this.checkIps(rule, clientIp);
                if (f1 && f2 && f3) {
                    if (rule.action == 'allow') {
                        const gateways = await this.configService.getGatewaysByNetworkId(network.id);
                        if (!gateways.find(x => x.isEnabled)) {
                            result.push({ network: network, action: 'deny', needsGateway: true });
                        } else
                            result.push({ network: network, action: 'allow', })
                        break
                    }
                    else {
                        break
                    }
                } else if (f1) {
                    result.push({ network: network, action: 'deny', needs2FA: !f2, needsIp: !f3 });
                    break;
                }
            }
        }

        return result;


    }


    //TODO
    authorizeErrorNumber = 0;
    async authorize(tunnel: Tunnel, serviceId: string, throwError: boolean = true): Promise<PolicyAuthzResult> {
        //TODO make this so fast

        this.authorizeErrorNumber = 0;
        if (!tunnel) {

            this.authorizeErrorNumber = 1;
            if (!throwError) return { error: this.authorizeErrorNumber };
            throw new RestfullException(401, ErrorCodes.ErrNotAuthorized, ErrorCodesInternal.ErrTunnelNotFoundOrNotValid, 'tunnel found');
        }
        logger.debug(`policy authz calculate trackId: ${tunnel.trackId} serviceId:${serviceId}`);


        if (!tunnel.id || !tunnel.clientIp || !tunnel.gatewayId || !tunnel.trackId) {
            this.authorizeErrorNumber = 2;

            if (!throwError) return { error: this.authorizeErrorNumber };
            throw new RestfullException(401, ErrorCodes.ErrTunnelFailed, ErrorCodesInternal.ErrTunnelNotFoundOrNotValid, 'secure tunnel failed');
        }
        const user = await this.configService.getUserById(tunnel.userId || '')
        if (!user) {

            this.authorizeErrorNumber = 3;
            if (!throwError) return { error: this.authorizeErrorNumber };
            throw new RestfullException(401, ErrorCodes.ErrNotAuthenticated, ErrorCodesInternal.ErrUserNotFound, 'not found');
        }
        try {
            await HelperService.isValidUser(user);
        } catch (err) {
            this.authorizeErrorNumber = 4;

            if (!throwError) return { error: this.authorizeErrorNumber };
            throw err;
        }


        const service = await this.configService.getService(serviceId);
        if (!service) {
            this.authorizeErrorNumber = 5;

            if (!throwError) return { error: this.authorizeErrorNumber };
            throw new RestfullException(401, ErrorCodes.ErrBadArgument, ErrorCodesInternal.ErrServiceNotFound, 'no service');
        }
        if (!service.isEnabled) {
            this.authorizeErrorNumber = 6;

            if (!throwError) return { error: this.authorizeErrorNumber };
            throw new RestfullException(401, ErrorCodes.ErrBadArgument, ErrorCodesInternal.ErrServiceNotValid, 'service is not enabled');
        }


        const network = await this.configService.getNetwork(service.networkId);
        if (!network) {
            this.authorizeErrorNumber = 7;

            if (!throwError) return { error: this.authorizeErrorNumber };
            throw new RestfullException(401, ErrorCodes.ErrBadArgument, ErrorCodesInternal.ErrNetworkNotFound, 'no network');
        }

        if (!network.isEnabled) {
            this.authorizeErrorNumber = 8;

            if (!throwError) return { error: this.authorizeErrorNumber };
            throw new RestfullException(401, ErrorCodes.ErrBadArgument, ErrorCodesInternal.ErrNetworkNotValid, 'no network');
        }
        const policy = await this.configService.getAuthorizationPolicy();
        const rules = await policy.rules.filter(x => x.serviceId == service.id);

        for (let i = 0; i < rules.length; ++i) {
            let rule = rules[i];
            if (!rule.isEnabled)
                continue;

            let f1 = await this.checkUserIdOrGroupId(rule, user);
            let f2 = await this.check2FA(rule, tunnel.is2FA || false);
            if (f1 && f2) {

                logger.debug(`policy authz calculate trackId: ${tunnel.trackId} serviceId:${serviceId} rule matched: ${rule.id}`);
                return { error: 0, index: i, rule: rule };
            }

        }
        //no rule match
        this.authorizeErrorNumber = 100;


        if (!throwError) return { error: this.authorizeErrorNumber };
        throw new RestfullException(401, ErrorCodes.ErrNotAuthenticated, ErrorCodesInternal.ErrNoRuleMatch, 'not authenticated');


    }

}
