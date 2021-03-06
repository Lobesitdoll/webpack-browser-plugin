import os from 'os';

import OsBrowsers from './os-browsers.json';

export default class WebpackBrowserPlugin {

  static cleanPublicPath(str) {
    let arr = str.split('');
    if (arr[0] === '/') {
      arr.splice(0, 1);
    }
    if (arr[arr.length - 1] === '/') {
      arr.splice(arr.length - 1, 1);
    }
    return arr.join('');
  }

  constructor(options) {
    const defaultOptions = {
      port: 8080,
      browser: 'default',
      url: null,
      publicPath: '',
      proxy: null,
      openOptions: null,
      bsOptions: null
    };
    if (options) {
      this.options = this.mergeOptions(options, defaultOptions);
    } else {
      this.options = defaultOptions;
    }
    this.firstRun = true;
    this.watch = false;
    this.dev = null;
    this.outputPath = null;
  }

  mergeOptions(options, defaults) {
    for (let key in defaults) {
      if (options.hasOwnProperty(key)) {
        defaults[key] = options[key];
      }
    }
    return defaults;
  }

  browserStr(browser) {
    browser = browser.toLowerCase();
    let valid = false;
    if (browser.indexOf('google') > -1 || browser.indexOf('chrome') > -1) {
      if (OsBrowsers[os.platform()].google) {
        browser = OsBrowsers[os.platform()].google.app;
        valid = true;
      }
    }
    if (browser.indexOf('fire') > -1 || browser.indexOf('fox') > -1) {
      if (OsBrowsers[os.platform()].firefox) {
        browser = OsBrowsers[os.platform()].firefox.app;
        valid = true;
      }
    }
    return {browser: browser, valid: valid};
  }

  buildUrl(options) {
    let url = options.url;
    if (this.options.url) {
      url = this.options.url;
      if (this.options.publicPath) {
        return `${url}/${this.options.publicPath}`;
      }
    } else {
      if (!!~options.url.indexOf('${port}')) {
        let url = options.url.replace('${port}', `:${options.port}`);
        return `${url}/${this.options.publicPath}`;
      } else if (options.port) {
        return `${options.url}:${options.port.toString()}/${this.options.publicPath}`;
      } else {
        return `${options.url}/${this.options.publicPath}`;
      }
    }
  }

  apply(compiler) {
    if (compiler.options.output.publicPath) {
      this.options.publicPath = WebpackBrowserPlugin.cleanPublicPath(compiler.options.output.publicPath);
    }
    if (compiler.options.port) {
      this.options.port = compiler.options.port;
    } else if (compiler.options.devServer) {
      if (compiler.options.devServer.port) {
        this.options.port = compiler.options.devServer.port;
      }
    }

    compiler.plugin('compilation', (compilation) => {
      if (compilation.options.watch) {
        this.watch = true;
      }
      if (compilation.compiler._plugins['watch-run']) {
        this.dev = true;
      } else {
        this.dev = false;
        this.outputPath = compilation.compiler.outputPath;
        console.log('outputPath', this.outputPath);
      }
    });

    compiler.plugin('done', (compilation) => {
      if (this.firstRun) {
        if (this.dev === true) {
          const open = require('opn');
          const url = this.buildUrl(this.options);
          let results = this.browserStr(this.options.browser);
          if (this.options.openOptions) {
            open(url, this.options.openOptions);
          } else {
            if (results.valid) {
              open(url, {app: results.browser});
            } else {
              open(url);
              if (results.browser !== 'default') {
                console.log(`Given browser params: '${this.options.browser}' were not valid or available. Default browser opened.`);
              }
            }
          }
        } else if (this.dev === false) {
          const bs = require('browser-sync').create();

          if (this.watch) {
            bs.watch(this.outputPath + '/**/*.js', (event, file) => {
              if (event === "change") {
                bs.reload();
              }
            });
          }
          bs.init(this.buildBSServer());
        } else {
          console.log('Failed Plugin: Webpack-Broswer-Plugin, incorrect params found.');
        }
        this.firstRun = false;
      }
    });
  }

  buildBSServer() {
    let server = [this.outputPath];
    if (this.options.publicPath && this.options.publicPath !== '') {
      server.push(`${this.outputPath}/${this.options.publicPath}`);
    }
    let bsOptions = {};
    if (this.options.bsOptions) {
      bsOptions = this.options.bsOptions;
    }  else {
      bsOptions.server = server;
      bsOptions.browser = this.options.browser;
      bsOptions.open = 'internal';
      if (this.options.publicPath) {
        bsOptions.startPath = this.options.publicPath
      }
      if (this.options.port) {
        bsOptions.port = this.options.port;
      }
    }

    console.log(bsOptions);

    return bsOptions;
  }

}
