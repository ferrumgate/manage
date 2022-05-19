import { Injectable, Injector } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpResponse, HttpEventType } from '@angular/common/http';
import { interval, Observable, of, throwError, timer } from 'rxjs';
import { catchError, map, finalize, retryWhen, take, delay, concatMap, delayWhen, scan, tap, mergeMap } from 'rxjs/operators';
import { AuthenticationService } from '../services/authentication.service';


import { NotificationService } from '../services/notification.service';
import { LoadingService } from 'src/app/modules/shared/loading/loading.service';
import { TranslationService } from '../services/translation.service';




@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {
    constructor(private injector: Injector) { }



    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

        const notificationService = this.injector.get(NotificationService);
        const authenticationService = this.injector.get(AuthenticationService);
        const translationService = this.injector.get(TranslationService);
        const loading = this.injector.get(LoadingService);
        loading.show();
        return next.handle(request).pipe(
            map((event: any) => {
                console.log('httperror interceptor is working');
                return event;
            }),
            retryWhen(errors =>
                errors.pipe(
                    tap(val => console.log(`retrying request`)),
                    delayWhen((err: any, index: number) => {
                        return (err.status >= 501 && index <= 1) ? timer(1000) : throwError(err);
                    }
                    ))),
            catchError((resp: any) => {
                if (resp.status == 428)//captcha required
                {
                    let url = new URL(window.location.href);
                    url.searchParams.set('isCaptchaEnabled', 'true');
                    location.href = url.toString();

                }
                else
                    if (resp.status === 401) {
                        if (window.location.href.indexOf('/register') >= 0 || window.location.href.indexOf('/login') >= 0) {

                        } else {
                            // auto logout if 401 response returned from api
                            authenticationService.logout();
                            notificationService.error(translationService.translate('ErrNotAuthorized'));

                            if (window.location.href.indexOf('/login') === -1) { // reload if not login page

                                location.href = '/login';


                            }

                        }


                    }
                return throwError(resp);
            }),
            finalize(() => loading.hide())
        );
    }
}
