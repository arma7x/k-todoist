window.addEventListener("load", function() {

  localforage.setDriver(localforage.LOCALSTORAGE);

  const CLIENT_ID = "37243c41f091443492812b2782548508";
  const SCOPE = 'task:add,data:read,data:read_write,data:delete,project:delete';

  const state = new KaiState({
    'TODOIST_SYNC': {},
  });

  const initTodoistWebsocket = function() {
    localforage.getItem('TODOIST_SYNC')
    .then((TODOIST_SYNC) => {
      if (TODOIST_SYNC != null) {
        if (TODOIST_SYNC.user != null) {
          if (TODOIST_SYNC.user.websocket_url != null) {
            console.log('WS', TODOIST_SYNC.user.websocket_url);
            const ws = new WebSocket(TODOIST_SYNC.user.websocket_url);
            ws.onclose = function() {
              console.log('WS', 'onclose');
            }
            ws.onerror = function() {
              console.log('WS', 'onerror');
            }
            ws.onmessage = function(msg) {
              console.log('WS', 'onmessage', msg.data);
              if (msg.data != null) {
                try {
                  const data = JSON.parse(msg.data);
                  if (data.type === "sync_needed") {
                    if (window['TODOIST_API'] != null ) {
                      window['TODOIST_API'].sync()
                      console.log(data.type);
                    }
                  }
                } catch (e) {
                  
                }
              }
            }
            ws.onopen = function() {
              console.log('WS', 'onopen');
            }
          }
        }
      }
    })
  }

  initTodoistWebsocket();

  const onCompleteSync = function(data) {
    localforage.setItem('TODOIST_SYNC', data)
    .then((TODOIST_SYNC) => {
      state.setState('TODOIST_SYNC', TODOIST_SYNC);
      console.log('onCompleteSync');
    })
  }

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

  const projectPage = function ($router, project_id) {}

  const taskPage = function ($router, project_id) {}

  const addProjectPage = new Kai({
    name: 'addProjectPage',
    data: {
      title: '',
      favorite: 'No',
      color_hex: '#b8b8b8',
      color_name: 'Grey',
      color_index: 48
    },
    verticalNavClass: '.addTaskNav',
    templateUrl: document.location.origin + '/templates/addProject.html',
    mounted: function() {
      this.$router.setHeaderTitle('Add Project');
    },
    unmounted: function() {},
    methods: {
      setFavorite: function() {
        var menu = [
          { "text": "Yes", "checked": false },
          { "text": "No", "checked": false }
        ];
        const idx = menu.findIndex((opt) => {
          return opt.text === this.data.favorite;
        });
        this.$router.showSingleSelector('Favorite', menu, 'Select', (selected) => {
          this.setData({ favorite: selected.text });
        }, 'Cancel', null, undefined, idx);
      },
      setColor: function() {
        var colors = [];
        for (var i in Todoist.Colors) {
          const name = Todoist.Colors[i][0];
          const words = name.split("_");
          for (let i = 0; i < words.length; i++) {
            words[i] = words[i][0].toUpperCase() + words[i].substr(1);
          }
          colors.push({ "text": words.join(" "), "hex": Todoist.Colors[i][1], 'index': i,"checked": false });
        }
        const idx = colors.findIndex((opt) => {
          return opt.hex === this.data.color_hex;
        });
        this.$router.showSingleSelector('Color', colors, 'Select', (selected) => {
          this.setData({ color_name: selected.text, color_hex: selected.hex, color_index: parseInt(selected.index) });
        }, 'Cancel', null, undefined, idx);
      }
    },
    softKeyText: { left: 'Back', center: 'SELECT', right: 'Add' },
    softKeyListener: {
      left: function() {
        this.$router.pop();
      },
      center: function() {
        const listNav = document.querySelectorAll(this.verticalNavClass);
        if (this.verticalNavIndex > -1) {
          if (listNav[this.verticalNavIndex]) {
            listNav[this.verticalNavIndex].click();
          }
        }
      },
      right: function() {
        if (window['TODOIST_API']) {
          this.$router.showLoading();
          window['TODOIST_API'].createProject(document.getElementById('project_title').value, null, this.data.color_index, (this.data.favorite === 'Yes' || false))
          .then(() => {
            this.$router.showToast('Success');
          })
          .catch((e) => {
            var msg;
            if (e.response) {
              msg = e.response.toString();
            } else {
              msg = e.toString();
            }
            this.$router.showToast(msg);
          })
          .finally(() => {
            this.$router.hideLoading();
          });
        }
      }
    },
    softKeyInputFocusText: { left: 'Done', center: '', right: '' },
    softKeyInputFocusListener: {
      left: function() {
        if (document.activeElement.tagName === 'INPUT') {
          document.activeElement.blur();
          this.dPadNavListener.arrowDown();
        }
      },
      center: function() {},
      right: function() {}
    },
    dPadNavListener: {
      arrowUp: function() {
        this.navigateListNav(-1);
        this.data.title = document.getElementById('project_title').value;
      },
      arrowRight: function() {
        // this.navigateTabNav(-1);
      },
      arrowDown: function() {
        this.navigateListNav(1);
        this.data.title = document.getElementById('project_title').value;
      },
      arrowLeft: function() {
        // this.navigateTabNav(1);
      },
    }
  });

  const updateProjectPage = function($router, id, name, color, favorite) {
    const cwords = Todoist.Colors[color][0].split("_");
    for (let i = 0; i < cwords.length; i++) {
      cwords[i] = cwords[i][0].toUpperCase() + cwords[i].substr(1);
    }
    setTimeout(() => {
      $router.push(
        new Kai({
          name: 'editProjectPage',
          data: {
            title: name,
            favorite: favorite ? 'Yes' : 'No',
            color_hex: Todoist.Colors[color][1],
            color_name: cwords.join(" "),
            color_index: color
          },
          verticalNavClass: '.addTaskNav',
          templateUrl: document.location.origin + '/templates/addProject.html',
          mounted: function() {
            this.$router.setHeaderTitle('Edit Project');
          },
          unmounted: function() {},
          methods: {
            setFavorite: function() {
              var menu = [
                { "text": "Yes", "checked": false },
                { "text": "No", "checked": false }
              ];
              const idx = menu.findIndex((opt) => {
                return opt.text === this.data.favorite;
              });
              this.$router.showSingleSelector('Favorite', menu, 'Select', (selected) => {
                this.setData({ favorite: selected.text });
              }, 'Cancel', null, undefined, idx);
            },
            setColor: function() {
              var colors = [];
              for (var i in Todoist.Colors) {
                const name = Todoist.Colors[i][0];
                const words = name.split("_");
                for (let i = 0; i < words.length; i++) {
                  words[i] = words[i][0].toUpperCase() + words[i].substr(1);
                }
                colors.push({ "text": words.join(" "), "hex": Todoist.Colors[i][1], 'index': i,"checked": false });
              }
              const idx = colors.findIndex((opt) => {
                return opt.hex === this.data.color_hex;
              });
              this.$router.showSingleSelector('Color', colors, 'Select', (selected) => {
                this.setData({ color_name: selected.text, color_hex: selected.hex, color_index: parseInt(selected.index) });
              }, 'Cancel', null, undefined, idx);
            }
          },
          softKeyText: { left: 'Back', center: 'SELECT', right: 'Update' },
          softKeyListener: {
            left: function() {
              this.$router.pop();
            },
            center: function() {
              const listNav = document.querySelectorAll(this.verticalNavClass);
              if (this.verticalNavIndex > -1) {
                if (listNav[this.verticalNavIndex]) {
                  listNav[this.verticalNavIndex].click();
                }
              }
            },
            right: function() {
              if (window['TODOIST_API']) {
                this.$router.showLoading();
                window['TODOIST_API'].updateProject(id, document.getElementById('project_title').value, this.data.color_index, (this.data.favorite === 'Yes' || false))
                .then(() => {
                  this.$router.showToast('Success');
                })
                .catch((e) => {
                  var msg;
                  if (e.response) {
                    msg = e.response.toString();
                  } else {
                    msg = e.toString();
                  }
                  this.$router.showToast(msg);
                })
                .finally(() => {
                  this.$router.hideLoading();
                });
              }
            }
          },
          softKeyInputFocusText: { left: 'Done', center: '', right: '' },
          softKeyInputFocusListener: {
            left: function() {
              if (document.activeElement.tagName === 'INPUT') {
                document.activeElement.blur();
                this.dPadNavListener.arrowDown();
              }
            },
            center: function() {},
            right: function() {}
          },
          dPadNavListener: {
            arrowUp: function() {
              this.navigateListNav(-1);
              this.data.title = document.getElementById('project_title').value;
            },
            arrowRight: function() {
              // this.navigateTabNav(-1);
            },
            arrowDown: function() {
              this.navigateListNav(1);
              this.data.title = document.getElementById('project_title').value;
            },
            arrowLeft: function() {
              // this.navigateTabNav(1);
            },
          }
        })
      );
    }, 101);
  }

  const homepage = new Kai({
    name: 'homepage',
    data: {
      title: 'homepage',
      offset: -1,
      projects: [],
      projectsVerticalNavIndexID: 0,
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
          if (window['TODOIST_API'] == null) {
            window['TODOIST_API'] = new Todoist(TODOIST_ACCESS_TOKEN, onCompleteSync);
            this.methods.sync();
          } else {
            localforage.getItem('TODOIST_SYNC')
            .then((TODOIST_SYNC) => {
              this.methods.listenStateSync(TODOIST_SYNC);
            })
          }
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
      listenStateSync: function(data) {
        var projects = [];
        data.projects.forEach((i) => {
          if (i.is_deleted === 0) {
            i.color_hex = Todoist.Colors[i.color][1];
            projects.push(i);
          }
        });
        if (projects.length > 0) {
          this.$router.setSoftKeyText('Menu', 'SELECT', 'More');
        } else {
          this.$router.setSoftKeyText('Menu', '', '');
        }
        if ((projects.length - 1) < this.verticalNavIndex) {
          this.verticalNavIndex--;
        }
        projects.sort((a,b) => (a.child_order > b.child_order) ? 1 : ((b.child_order > a.child_order) ? -1 : 0));
        this.setData({ projects: projects, empty: (projects.length === 0 ? true : false) });
        console.log(projects);
      },
      toggleSoftKeyText: function() {
        setTimeout(() => {
          if (!this.$router.bottomSheet) {
            if (this.data.projects.length > 0) {
              this.$router.setSoftKeyText('Menu', 'SELECT', 'More');
            } else {
              this.$router.setSoftKeyRightText('Menu', '', '');
            }
          }
        }, 100);
      },
      deleteArticle: function() {},
      nextPage: function() {},
      selected: function() {}
    },
    softKeyText: { left: '', center: '', right: '' },
    softKeyListener: {
      left: function() {
        localforage.getItem('TODOIST_ACCESS_TOKEN')
        .then((res) => {
          var title = 'Menu';
          var menu = [
            { "text": "Help & Support" },
            { "text": "Login" }
          ];
          if (res) {
            menu = [
              { "text": "Help & Support" },
              { "text": "Sync" },
              { "text": "Add Project" },
              { "text": "Logout" }
            ];
          }
          this.$router.showOptionMenu(title, menu, 'Select', (selected) => {
            if (selected.text === 'Login') {
              loginPage(this.$router);
            } else if (selected.text === 'Add Project') {
              this.$router.push('addProjectPage');
            } else if (selected.text === 'Logout') {
              window['TODOIST_API'] = null;
              localforage.removeItem('TODOIST_ACCESS_TOKEN');
              localforage.removeItem('TODOIST_SYNC');
              this.verticalNavIndex = 0;
              this.$router.setSoftKeyRightText('');
              this.setData({ TODOIST_ACCESS_TOKEN: null });
              this.setData({ projects: [], offset: -1 });
            } else if (selected.text === 'Sync') {
              this.methods.sync();
            } else if (selected.text ===  'Help & Support') {
              this.$router.push('helpSupportPage');
            }
          }, () => {
            this.methods.toggleSoftKeyText();
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
        var title = 'Options';
        var menu = [
          { "text": "Edit Project" },
          { "text": "Completed Tasks" },
          { "text": "Comments" },
          { "text": "Delete Project" }
        ];
        this.$router.showOptionMenu(title, menu, 'Select', (selected) => {
          var proj = this.data.projects[this.verticalNavIndex];
          if (selected.text === 'Edit Project') {
            if (proj) {
              updateProjectPage(this.$router, proj.id, proj.name, proj.color, proj.is_favorite);
            }
          } else if (selected.text === 'Completed Taks') {
            if (proj) {
            }
          } else if (selected.text === 'Delete Project') {
            if (proj) {
              this.$router.showDialog('Confirm', 'Are you sure to delete ' + proj.name + ' ?', null, 'Yes', () => {
                this.$router.showLoading();
                window['TODOIST_API'].deleteProject(proj.id)
                .then(() => {
                  this.$router.showToast('Success');
                })
                .catch((e) => {
                  var msg;
                  if (e.response) {
                    msg = e.response.toString();
                  } else {
                    msg = e.toString();
                  }
                  this.$router.showToast(msg);
                })
                .finally(() => {
                  this.$router.hideLoading();
                });
              }, 'No', () => {}, '', () => {}, () => {
                this.methods.toggleSoftKeyText();
              });
            }
          }
        }, () => {
          this.methods.toggleSoftKeyText();
        }, 0);
      }
    },
    backKeyListener: function() {
      return false;
    },
    dPadNavListener: {
      arrowUp: function() {
        if (this.verticalNavIndex === 0 || this.data.projects.length === 0) {
          return;
        }
        this.navigateListNav(-1);
      },
      arrowRight: function() {},
      arrowDown: function() {
        if (this.verticalNavIndex === (this.data.projects.length - 1)  || this.data.projects.length === 0) {
          return;
        }
        this.navigateListNav(1);
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
      },
      'addProjectPage': {
        name: 'addProjectPage',
        component: addProjectPage
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
