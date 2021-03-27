window.addEventListener("load", function() {

  localforage.setDriver(localforage.LOCALSTORAGE);

  const CLIENT_ID = "37243c41f091443492812b2782548508";
  const SCOPE = 'task:add,data:read,data:read_write,data:delete,project:delete';

  const state = new KaiState({
    'TODOIST_SYNC': {},
  });

  function getURLParam(key, target) {
    var values = [];
    if (!target) target = location.href;

    key = key.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");

    var pattern = key + '=([^&#]+)';
    var o_reg = new RegExp(pattern,'ig');
    while (true){
      var matches = o_reg.exec(target);
      if (matches && matches[1]){
        values.push(matches[1]);
      } else {
        break;
      }
    }

    if (!values.length){
      return [];
    } else {
      return values.length == 1 ? [values[0]] : values;
    }
  }

  const helpSupportPage = new Kai({
    name: 'helpSupportPage',
    data: {
      title: 'helpSupportPage'
    },
    template: '<div style="padding:4px;"><style>.kui-software-key{height:0px}</style><b>NOTICE</b><br>Save button within the https://getpocket.com/explore is not working. Please use `Save to GetPocket` to save website you visited to your GetPocket account<br><br><b>Reader View</b><br>Parses html text (usually news and other articles) and returns title, author, main image and text content without nav bars, ads, footers, or anything that isn\'t the main body of the text. Analyzes each node, gives them a score, and determines what\'s relevant and what can be discarded<br><br> <b>Shortcut Key</b><br>* 1 Zoom-out<br> * 2 Reset zoom<br> * 3 Zoom-in<br> * 5 Hide/Show menu</div>',
    mounted: function() {
      this.$router.setHeaderTitle('Help & Support');
    },
    unmounted: function() {},
    methods: {},
    softKeyText: { left: '', center: '', right: '' },
    softKeyListener: {
      left: function() {},
      center: function() {},
      right: function() {}
    }
  });

  const loginPage = function($router) {
    var salt = window.crypto.getRandomValues(new Uint32Array(10))[0].toString();
    const hashids2 = new Hashids(salt, 15);
    const random = hashids2.encode(1);
    var url = `https://todoist.com/oauth/authorize?client_id=${CLIENT_ID}&scope=${SCOPE}&state=${random}`
    $router.push(new Kai({
      name: 'loginPage',
      data: {
        title: 'loginPage'
      },
      templateUrl: document.location.origin + '/templates/login.html',
      mounted: function() {
        const hdr = document.getElementById('__kai_header__');
        hdr.classList.add("sr-only");
        const sk = document.getElementById('__kai_soft_key__');
        sk.classList.add("sr-only");
        const kr = document.getElementById('__kai_router__');
        kr.classList.add("full-screen-browser");
        navigator.spatialNavigationEnabled = true;
        var frameContainer = document.getElementById('login-container');
        loginTab = new Tab(url);
        window['loginTab'] = loginTab;
        loginTab.iframe.setAttribute('height', '296px;');
        loginTab.iframe.setAttribute('style', 'padding:2px;');
        loginTab.iframe.setAttribute('frameBorder', '0');
        var container = document.querySelector('#login-container');
        var root1 = container.createShadowRoot();
        var root2 = container.createShadowRoot();
        root1.appendChild(loginTab.iframe);
        var shadow = document.createElement('shadow');
        root2.appendChild(shadow);
        loginTab.iframe.addEventListener('mozbrowserlocationchange', function (e) {
          if (e.detail.url.indexOf('https://malaysiaapi.herokuapp.com/todoist/api/v1/redirect') > -1) {
            console.log(window['loginTab'].url.url);
            const codeToken = getURLParam('code', window['loginTab'].url.url);
            const stateToken = getURLParam('state', window['loginTab'].url.url);
            if (codeToken.length > 0 && stateToken.length > 0) {
              var oauthAuthorize = new XMLHttpRequest({ mozSystem: true });
              oauthAuthorize.open('GET', 'https://malaysiaapi.herokuapp.com/todoist/api/v1/exchange_token?code=' + codeToken[0], true);
              oauthAuthorize.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
              oauthAuthorize.setRequestHeader("X-Accept", 'application/json');
              oauthAuthorize.onreadystatechange = function() {
                if(oauthAuthorize.readyState == 4 && oauthAuthorize.status == 200) {
                  if (oauthAuthorize.response) {
                    var obj = JSON.parse(oauthAuthorize.response);
                    localforage.setItem('TODOIST_ACCESS_TOKEN', obj.data)
                    $router.showToast('Login Success');
                    $router.pop();
                  } else {
                    $router.showToast('Invalid response');
                    $router.pop();
                  }
                } else if (oauthAuthorize.status == 403) {
                  $router.showToast('Unauthorize 403');
                  $router.pop();
                } else if (oauthAuthorize.readyState == 4) {
                  $router.showToast('Unknown Error');
                  $router.pop();
                }
              }
              oauthAuthorize.send();
            }
          }
        });
      },
      unmounted: function() {
        const hdr = document.getElementById('__kai_header__');
        hdr.classList.remove("sr-only");
        const sk = document.getElementById('__kai_soft_key__');
        sk.classList.remove("sr-only");
        const kr = document.getElementById('__kai_router__');
        kr.classList.remove("full-screen-browser");
        navigator.spatialNavigationEnabled = false;
      },
      methods: {
        listenState: function() {}
      },
      softKeyText: { left: '', center: '', right: '' },
      softKeyListener: {
        left: function() {},
        center: function() {},
        right: function() {}
      },
      backKeyListener: function() {
        window['loginTab'].getCanGoBack()
        .then((canGoBack) => {
          if (canGoBack) {
            window['loginTab'].goBack();
          } else {
            this.$router.pop();
          }
        });
        return true;
      }
    }));
  }

  const homepage = new Kai({
    name: 'homepage',
    data: {
      title: 'homepage',
      offset: -1,
      projects: [],
      empty: true,
      TODOIST_ACCESS_TOKEN: null
    },
    verticalNavClass: '.homepageNav',
    templateUrl: document.location.origin + '/templates/homepage.html',
    mounted: function() {
      this.$router.setHeaderTitle('K-Todoist');
      this.$state.addStateListener('TODOIST_SYNC', this.methods.listenStateSync);
      navigator.spatialNavigationEnabled = false;
      localforage.getItem('TODOIST_ACCESS_TOKEN')
      .then((TODOIST_ACCESS_TOKEN) => {
        if (TODOIST_ACCESS_TOKEN != null) {
          this.setData({ TODOIST_ACCESS_TOKEN: TODOIST_ACCESS_TOKEN });
          window['TODOIST_API'] = new Todoist(TODOIST_ACCESS_TOKEN, this.methods.onCompleteSync);
          this.methods.sync();
        }
      });
    },
    unmounted: function() {
      this.$state.removeStateListener('TODOIST_SYNC', this.methods.listenStateSync);
    },
    methods: {
      sync: function() {
        if (window['TODOIST_API']) {
          this.$router.showToast('Sync');
          this.$router.showLoading();
          window['TODOIST_API'].sync()
          .then((res) => {
            this.$router.showToast('Done Sync');
          })
          .catch(() => {
            this.$router.showToast('Error Sync');
          })
          .finally(() => {
            this.$router.hideLoading();
          })
        }
      },
      onCompleteSync: function(data) {
        localforage.setItem('TODOIST_SYNC', data)
        .then((TODOIST_SYNC) => {
          this.$state.setState('TODOIST_SYNC', TODOIST_SYNC);
        })
      },
      listenStateSync: function(data) {
        var projects = [];
        data.projects.forEach((i) => {
          if (i.is_deleted === 0) {
            i.color_hex = Todoist.Colors[i.color][1];
            projects.push(i);
          }
        });
        projects.sort((a,b) => (a.child_order > b.child_order) ? 1 : ((b.child_order > a.child_order) ? -1 : 0));
        this.setData({ projects: projects, empty: (projects.length === 0 ? true : false) });
        console.log(projects);
      },
      deleteArticle: function() {},
      nextPage: function() {},
      selected: function() {}
    },
    softKeyText: { left: 'Menu', center: '', right: '' },
    softKeyListener: {
      left: function() {
        localforage.getItem('TODOIST_ACCESS_TOKEN')
        .then((res) => {
          var title = 'Menu';
          var menu = [
            { "text": "Help & Support" },
            { "text": "Login" },
            { "text": "Web Browser" },
            { "text": "Saved Reader View" },
            { "text": "Bookmarks" },
            { "text": "History" },
            { "text": "Clear History" }
          ];
          if (res) {
            title = res.username;
            menu = [
              { "text": "Help & Support" },
              { "text": "Refresh" },
              { "text": "Web Browser" },
              { "text": "Saved Reader View" },
              { "text": "Bookmarks" },
              { "text": "History" },
              { "text": "Clear History" },
              { "text": "Logout" }
            ];
          }
          this.$router.showOptionMenu(title, menu, 'Select', (selected) => {
            if (selected.text === 'Login') {
              loginPage(this.$router);
            } else if (selected.text === 'Web Browser') {
              this.$router.push('browser');
            } else if (selected.text === 'Logout') {
              localforage.removeItem('TODOIST_ACCESS_TOKEN');
              this.verticalNavIndex = 0;
              this.$router.setSoftKeyRightText('');
              this.setData({ TODOIST_ACCESS_TOKEN: null });
              this.setData({ projects: [], offset: -1 });
            } else if (selected.text === 'Refresh') {
              this.verticalNavIndex = 0;
              this.setData({ projects: [] });
              this.methods.sync();
            } else if (selected.text === 'Bookmarks') {
              localforage.getItem('POCKET_BOOKMARKS')
              .then((bookmarks) => {
                if (bookmarks) {
                  if (bookmarks.length > 0) {
                    var b = [];
                    bookmarks.forEach((i) => {
                      b.push({ "text": typeof i.title === "string" ? i.title : 'Unknown', "subtext": i.url });
                    });
                    this.$router.showOptionMenu('Bookmarks', b, 'OPEN', (selected) => {
                      this.$state.setState('target_url', selected.subtext);
                      setTimeout(() => {
                        this.$router.push('browser');
                      }, 100);
                    }, () => {
                      setTimeout(() => {
                        if (!this.$router.bottomSheet) {
                          if (this.data.projects[this.verticalNavIndex].isArticle) {
                            this.$router.setSoftKeyRightText('More');
                          } else {
                            this.$router.setSoftKeyRightText('');
                          }
                        }
                      }, 100);
                    }, 0);
                  }
                }
              });
            } else if (selected.text === 'History') {
              localforage.getItem('POCKET_HISTORY')
              .then((history) => {
                if (history) {
                  if (history.length > 0) {
                    var b = [];
                    history.forEach((i) => {
                      b.push({ "text": typeof i.title === "string" ? i.title : 'Unknown', "subtext": i.url });
                    });
                    this.$router.showOptionMenu('History', b, 'OPEN', (selected) => {
                      this.$state.setState('target_url', selected.subtext);
                      setTimeout(() => {
                        this.$router.push('browser');
                      }, 100);
                    }, () => {
                      setTimeout(() => {
                        if (!this.$router.bottomSheet) {
                          if (this.data.projects[this.verticalNavIndex].isArticle) {
                            this.$router.setSoftKeyRightText('More');
                          } else {
                            this.$router.setSoftKeyRightText('');
                          }
                        }
                      }, 100);
                    }, 0);
                  }
                }
              });
            } else if (selected.text === 'Clear History') {
              this.$router.showDialog('Confirm', 'Are you sure to clear history ?', null, 'Yes', () => {
                localforage.removeItem('POCKET_HISTORY')
                this.$router.showToast('History Cleared');
              }, 'No', () => {}, '', () => {}, () => {
                setTimeout(() => {
                  if (this.data.projects[this.verticalNavIndex].isArticle) {
                    this.$router.setSoftKeyRightText('More');
                  } else {
                    this.$router.setSoftKeyRightText('');
                  }
                }, 100);
              });
            } else if (selected.text ===  'Help & Support') {
              this.$router.push('helpSupportPage');
            } else if (selected.text === 'Saved Reader View') {
              setTimeout(() => {
                this.$router.push('offlineprojects');
              }, 110);
            }
          }, () => {
            setTimeout(() => {
              if (!this.$router.bottomSheet && this.$router.stack[this.$router.stack.length - 1].name === 'homepage') {
                if (this.data.projects[this.verticalNavIndex].isArticle) {
                  this.$router.setSoftKeyRightText('More');
                } else {
                  this.$router.setSoftKeyRightText('');
                }
              }
            }, 100);
          }, 0);
        })
        .catch((err) => {
          //console.log(err);
        });
      },
      center: function() {
        if (this.verticalNavIndex > -1) {
          const nav = document.querySelectorAll(this.verticalNavClass);
          nav[this.verticalNavIndex].click();
        }
      },
      right: function() {
        var title = 'Menu';
        var menu = [
          { "text": "Open with built-in browser" },
          { "text": "Open with KaiOS Browser" },
          { "text": "Open with Reader View" },
          { "text": "Save Reader View" },
          { "text": "Delete" }
        ];
        var current = this.data.projects[this.verticalNavIndex];
        var hashids = new Hashids(current.given_url, 10);
        var id = hashids.encode(1);
        localforage.getItem('CONTENT___' + id)
        .then((article) => {
          if (article != null) {
            menu[3] = { "text": "Delete Reader View" }
          }
          this.$router.showOptionMenu(title, menu, 'Select', (selected) => {
            if (selected.text === 'Open with built-in browser') {
              this.$state.setState('target_url', current.given_url);
              this.$router.push('browser');
            } else if (selected.text === 'Open with KaiOS Browser') {
              var activity = new MozActivity({
                name: "view",
                data: {
                  type: "url",
                  url: current.given_url
                }
              });
            } else if (selected.text === 'Delete') {
              this.methods.deleteArticle();
            } else if (selected.text === 'Open with Reader View') {
              readabilityPage(this.$router, current.given_url, current.title, false);
            } else if (selected.text === 'Save Reader View') {
              readabilityPage(this.$router, current.given_url, '', true);
            } else if (selected.text === 'Delete Reader View') {
              localforage.getItem('projects')
              .then((projects) => {
                var filtered = [];
                if (projects != null) {
                  filtered = projects.filter(function(a) {
                    return a.hashid != id;
                  });
                  localforage.setItem('projects', filtered)
                  .then(() => {
                    localforage.removeItem('CONTENT___' + id)
                    this.$router.showToast('Success');
                  });
                }
              })
            }
          }, () => {
            setTimeout(() => {
              if (!this.$router.bottomSheet) {
                if (this.data.projects[this.verticalNavIndex].isArticle) {
                  this.$router.setSoftKeyRightText('More');
                } else {
                  this.$router.setSoftKeyRightText('');
                }
              }
            }, 100);
          }, 0);
        });
      }
    },
    backKeyListener: function() {
      return false;
    },
    dPadNavListener: {
      arrowUp: function() {
        if (this.verticalNavIndex === 0) {
          return;
        }
        this.navigateListNav(-1);
        if (this.data.projects[this.verticalNavIndex].isArticle) {
          this.$router.setSoftKeyRightText('More');
        } else {
          this.$router.setSoftKeyRightText('');
        }
      },
      arrowRight: function() {},
      arrowDown: function() {
        if (this.verticalNavIndex === (this.data.projects.length - 1)) {
          return;
        }
        this.navigateListNav(1);
        if (this.data.projects[this.verticalNavIndex].isArticle) {
          this.$router.setSoftKeyRightText('More');
        } else {
          this.$router.setSoftKeyRightText('');
        }
      },
      arrowLeft: function() {},
    }
  });

  const router = new KaiRouter({
    title: 'K-Todoist',
    routes: {
      'index' : {
        name: 'homepage',
        component: homepage
      },
      'helpSupportPage': {
        name: 'helpSupportPage',
        component: helpSupportPage
      }
    }
  });

  const app = new Kai({
    name: '_APP_',
    data: {},
    templateUrl: document.location.origin + '/templates/template.html',
    mounted: function() {},
    unmounted: function() {},
    router,
    state
  });

  try {
    app.mount('app');
  } catch(e) {
    //console.log(e);
  }

  document.addEventListener('visibilitychange', () => {
    console.log(document.visibilityState)
  });

  getKaiAd({
    publisher: 'ac3140f7-08d6-46d9-aa6f-d861720fba66',
    app: 'k-todoist',
    slot: 'kaios',
    onerror: err => console.error(err),
    onready: ad => {
      ad.call('display')
    }
  })

});
