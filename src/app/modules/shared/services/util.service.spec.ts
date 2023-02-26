import { HttpClient, HttpClientModule } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ReCaptchaV3Service, RECAPTCHA_V3_SITE_KEY } from 'ng-recaptcha';
import { of } from 'rxjs';
import { SharedModule } from 'src/app/modules/shared/shared.module';
import { AuditService } from './audit.service';
import { CaptchaService } from './captcha.service';
import { ConfigService } from './config.service';

import { NetworkService } from './network.service';
import { UtilService } from './util.service';



describe('UtilService', () => {
  let service: UtilService;
  let httpClient: HttpClient;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [RouterTestingModule, TranslateModule.forRoot(), HttpClientModule],
      providers: [TranslateService, ConfigService, HttpClient,
        CaptchaService,
        ReCaptchaV3Service,
        {
          provide: RECAPTCHA_V3_SITE_KEY,
          useValue: '',

        }]
    });
    service = TestBed.inject(AuditService);
    httpClient = TestBed.inject(HttpClient);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });



});
