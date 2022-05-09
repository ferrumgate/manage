import { Component, HostBinding, OnInit } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { AuthenticationService } from './core/services/authentication.service';
import { ConfigService } from './core/services/config.service';
import { LoggerService } from './core/services/logger.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  /**
   *
   */
  private isDark = false;
  @HostBinding('class')
  get themeMode() {
    return this.isDark ? 'theme-dark' : 'theme-light';
  }
  constructor(private router: Router, private configService: ConfigService,
    private loggerService: LoggerService,
    private authenticationService: AuthenticationService,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer
  ) {

    this.matIconRegistry.addSvgIcon(
      "social-github",
      this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/img/social/github.svg")
    );
    this.matIconRegistry.addSvgIcon(
      "social-linkedin",
      this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/img/social/linkedin.svg")
    );
    this.matIconRegistry.addSvgIcon(
      "social-google",
      this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/img/social/google.svg")
    );
    this.matIconRegistry.addSvgIcon(
      "social-microsoft",
      this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/img/social/microsoft.svg")
    );
    // subsribe to theme changes
    this.configService.themeChanged.subscribe(x => {
      this.isDark = x == 'dark';
    })
    const user = this.authenticationService.currentSession?.currentUser;
    this.configService.init(user?.id || 'empty');
    this.authenticationService.checkSession();
  }
  ngOnInit(): void {
    // this.router.navigateByUrl('/login');
  }



}
