const APP_VERSION = '1.1.0';

window.addEventListener("load", function() {

  localforage.setDriver(localforage.LOCALSTORAGE);

  function isElementInViewport(el, marginTop = 0, marginBottom = 0) {
    if (!el.getBoundingClientRect)
      return
    var rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 + marginTop &&
        rect.left >= 0 &&
        rect.bottom <= ((window.innerHeight || document.documentElement.clientHeight) - marginBottom) && /* or $(window).height() */
        rect.right <= (window.innerWidth || document.documentElement.clientWidth) /* or $(window).width() */
    );
  }

  const CLIENT_ID = "37243c41f091443492812b2782548508";
  const SCOPE = 'task:add,data:read,data:read_write,data:delete,project:delete';
  var IFRAME_TIMER;

  const state = new KaiState({
    'TODOIST_SYNC': {},
  });

  const initTodoistWebsocket = function() {
    localforage.getItem('TODOIST_SYNC')
    .then((TODOIST_SYNC) => {
      if (TODOIST_SYNC != null) {
        if (TODOIST_SYNC.user != null) {
          if (TODOIST_SYNC.user.websocket_url != null) {
            // console.log('WS', TODOIST_SYNC.user.websocket_url);
            const ws = new WebSocket(TODOIST_SYNC.user.websocket_url);
            ws.onclose = function() {
              // console.log('ws.onclose');
              initTodoistWebsocket();
            }
            ws.onmessage = function(msg) {
              if (msg.data != null) {
                try {
                  const data = JSON.parse(msg.data);
                  if (data.type === "sync_needed") {
                    if (window['TODOIST_API'] != null ) {
                      router.showLoading();
                      window['TODOIST_API'].sync()
                      .finally(() => {
                        router.hideLoading();
                      })
                      // console.log(data.type);
                    }
                  }
                } catch (e) {}
              }
            }
            ws.onopen = function() {
              // console.log('ws.onopen');
              if (window['TODOIST_API'] != null ) {
                router.showLoading();
                window['TODOIST_API'].sync()
                .finally(() => {
                  router.hideLoading();
                })
              }
            }
          }
        }
      }
    })
  }

  const onCompleteSync = function(data) {
    if (data == null) {
      return
    }
    localforage.setItem('TODOIST_SYNC', data)
    .then((TODOIST_SYNC) => {
      state.setState('TODOIST_SYNC', TODOIST_SYNC);
      // console.log('onCompleteSync', TODOIST_SYNC['projects']);
    })
  }

  function ymd(yourDate){
    const offset = yourDate.getTimezoneOffset()
    yourDate = new Date(yourDate.getTime() - (offset*60*1000))
    return yourDate.toISOString().split('T')[0]
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

  function extractTodayItems(items) {
    var now = new Date();
    var _tasks = [];
    items.forEach((i) => {
      if (i.is_deleted == 0 && i.due != null) {
        const idx = items.findIndex((j) => {
          return j.parent_id === i.id && j.is_deleted == 0;
        });
        i.is_due = false;
        i.has_subtask = false;
        i.total_subtask = 0;
        i.parsed_content = DOMPurify.sanitize(snarkdown(i.content));
        if (idx > -1) {
          i.has_subtask = true;
          const found = items.filter((k) => {
            return k.parent_id === i.id && k.is_deleted == 0;
          });
          i.total_subtask = found.length;
        }
        i.due_string = '-';
        var date = new Date(i.due.date);
        if (date < now) {
          i.is_due = true;
        }
        i.due_string = ymd(date);
        if (i.due.date.indexOf('T') === 10) {
          var datetime = new Date(i.due.date);
          if (datetime < now) {
            i.is_due = true;
          } else {
            i.is_due = false;
          }
          i.due_string = datetime.toLocaleString();
        }
        if (!i.has_subtask && (i.is_due || now.toLocaleDateString() === date.toLocaleDateString())) {
          _tasks.push(i);
        }
      }
    });
    _tasks.sort((a,b) => (a.child_order > b.child_order) ? 1 : ((b.child_order > a.child_order) ? -1 : 0));
    return _tasks;
  }

  function extractItems(items, project_id, parent_id, section_id) {
    var _tasks = [];
    items.forEach((i) => {
      if (i.project_id === project_id && i.parent_id === parent_id && i.section_id === section_id && i.is_deleted == 0) {
        const idx = items.findIndex((j) => {
          return j.parent_id === i.id && j.is_deleted == 0;
        });
        i.is_due = false;
        i.has_subtask = false;
        i.total_subtask = 0;
        i.parsed_content = DOMPurify.sanitize(snarkdown(i.content));
        if (idx > -1) {
          i.has_subtask = true;
          const found = items.filter((k) => {
            return k.parent_id === i.id && k.is_deleted == 0;
          });
          i.total_subtask = found.length;
        }
        i.due_string = '-';
        if (i.due) {
          var now = new Date();
          var date = new Date(i.due.date);
          if (date < now) {
            i.is_due = true;
          }
          i.due_string = ymd(date);
          if (i.due.date.indexOf('T') === 10) {
            var datetime = new Date(i.due.date);
            if (datetime < now) {
              i.is_due = true;
            } else {
              i.is_due = false;
            }
            i.due_string = datetime.toLocaleString();
          }
        }
        _tasks.push(i);
      }
    });
    _tasks.sort((a,b) => (a.child_order > b.child_order) ? 1 : ((b.child_order > a.child_order) ? -1 : 0));
    return _tasks;
  }

  function extractSections(sections, project_id) {
    var _sections = [];
    sections.forEach((i) => {
      if (i.project_id === project_id && i.is_deleted == 0) {
        _sections.push(i);
      }
    });
    _sections.sort((a,b) => (a.section_order > b.section_order) ? 1 : ((b.section_order > a.section_order) ? -1 : 0));
    return _sections;
  }

  const helpSupportPage = new Kai({
    name: 'helpSupportPage',
    data: {
      title: 'helpSupportPage'
    },
    template: `<div style="padding:4px;"><style>.kui-software-key{height:0px}#__kai_router__{height:266px!important;}.kui-router-m-bottom{margin-bottom:0px!important;}</style>
      <h5 style="margin-top:6px;margin-bottom:2px;"># New features:</h5>
      <ul style="padding: 1px 0 1px 20px;font-size:14px;margin-bottom:2px;">
        <li style="margin-right:0px;margin-bottom:3px;">Add <b>description</b> field for Task</li>
        <li style="margin-right:0px;margin-bottom:3px;"><b>Task Viewer</b> support markdown markup(for description field)</li>
        <li style="margin-right:0px;margin-bottom:3px;"><b>Task Viewer</b> support navigation between anchor tags</li>
      </ul>
      <h5 style="margin-top:6px;margin-bottom:2px;"># Task Viewer Shortcut key:</h5>
      <ul style="padding: 1px 0 1px 20px;font-size:14px;margin-bottom:2px;">
        <li style="margin-right:0px;margin-bottom:3px;"><b>Arrow Up</b> or <b>Arrow Down</b> to scroll the page</li>
        <li style="margin-right:0px;margin-bottom:3px;"><b>Arrow Left</b> or <b>Arrow Right</b> to jump between anchor tag</li>
        <li style="margin-right:0px;margin-bottom:3px;"><b>Enter</b> to select anchor tag</li>
      </ul>
      <h5 style="margin-top:6px;margin-bottom:2px;"># List of unavailable Premium features(maybe implemented on next update):</h5>
      <ul style="padding: 1px 0 1px 20px;font-size:14px;margin-bottom:2px;">
        <li style="margin-right:0px;margin-bottom:3px;">Backups</li>
        <li style="margin-right:0px;margin-bottom:3px;">Archive a project</li>
        <li style="margin-right:0px;margin-bottom:3px;">Unarchive a project</li>
        <li style="margin-right:0px;margin-bottom:3px;">Filters</li>
        <li style="margin-right:0px;margin-bottom:3px;">Label</li>
        <li style="margin-right:0px;margin-bottom:3px;">User settings</li>
        <li style="margin-right:0px;margin-bottom:3px;">Templates</li>
        <li style="margin-right:0px;margin-bottom:3px;">Reminders</li>
        <li style="margin-right:0px;margin-bottom:3px;">Get all completed items(Task)</li>
        <li style="margin-right:0px;margin-bottom:3px;">Project Notes(Project Comment)</li>
        <li style="margin-right:0px;margin-bottom:3px;">Item Notes(Task Comment)</li>
      </ul>
    </div>`,
    mounted: function() {
      this.$router.setHeaderTitle('Help & Support');
      navigator.spatialNavigationEnabled = false;
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
    var ping = new XMLHttpRequest({ mozSystem: true });
    ping.open('GET', 'https://malaysiaapi.herokuapp.com/', true);
    ping.send();

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
        loginTab.iframe.addEventListener('mozbrowserloadstart', () => {
          $router.showLoading(false);
        });
        loginTab.iframe.addEventListener('mozbrowserloadend', () => {
          this.$router.hideLoading();
        });
        var container = document.querySelector('#login-container');
        var root1 = container.createShadowRoot();
        var root2 = container.createShadowRoot();
        root1.appendChild(loginTab.iframe);
        var shadow = document.createElement('shadow');
        root2.appendChild(shadow);
        loginTab.iframe.addEventListener('mozbrowserlocationchange', function (e) {
          if (e.detail.url.indexOf('https://malaysiaapi.herokuapp.com/todoist/api/v1/redirect') > -1) {
            // console.log(window['loginTab'].url.url);
            const codeToken = getURLParam('code', window['loginTab'].url.url);
            const stateToken = getURLParam('state', window['loginTab'].url.url);
            if (codeToken.length > 0 && stateToken.length > 0) {
              setTimeout(() => {
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
                      $router.hideLoading()
                      $router.pop();
                    } else {
                      $router.hideLoading()
                      $router.showToast('Invalid response');
                      $router.pop();
                    }
                  } else if (oauthAuthorize.status == 403) {
                    $router.hideLoading()
                    $router.showToast('Unauthorize 403');
                    $router.pop();
                  } else if (oauthAuthorize.readyState == 4) {
                    $router.hideLoading()
                    $router.showToast('Unknown Error');
                    $router.pop();
                  }
                }
                $router.showLoading();
                oauthAuthorize.send();
              }, 500);
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

  const addProjectPage = function($router, id, name, color, favorite) {
    $router.push(
      new Kai({
        name: 'addProjectPage',
        data: {
          title: name || '',
          favorite: favorite ? 'Yes' : 'No',
          color_hex: color ? Todoist.Colors[color][1] : '#b8b8b8',
          color_name: color ? Todoist.Colors[color][0] : 'Grey',
          color_index: color || 48
        },
        verticalNavClass: '.addProjNav',
        templateUrl: document.location.origin + '/templates/addProject.html',
        mounted: function() {
          this.$router.setHeaderTitle(id ? 'Update Project' : 'Add Project');
          navigator.spatialNavigationEnabled = false;
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
              colors.push({ "text": Todoist.Colors[i][0], "hex": Todoist.Colors[i][1], 'index': i,"checked": false });
            }
            const idx = colors.findIndex((opt) => {
              return opt.hex === this.data.color_hex;
            });
            this.$router.showSingleSelector('Color', colors, 'Select', (selected) => {
              this.setData({ color_name: selected.text, color_hex: selected.hex, color_index: parseInt(selected.index) });
            }, 'Cancel', null, undefined, idx);
          }
        },
        softKeyText: { left: 'Back', center: 'SELECT', right: id ? 'Update' : 'Add' },
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
              var req;
              if (id) {
                req = window['TODOIST_API'].updateProject(id, document.getElementById('project_title').value, this.data.color_index, (this.data.favorite === 'Yes' || false))
              } else {
                req = window['TODOIST_API'].createProject(document.getElementById('project_title').value, null, this.data.color_index, (this.data.favorite === 'Yes' || false))
              }
              req.then(() => {
                this.$router.showToast('Success');
                this.$router.pop();
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
  }

  const taskPage = function($router, task_id) {
    const idx = state.getState('TODOIST_SYNC')['items'].find((j) => {
      return j.id === task_id;
    });
    if (idx) {
      var ANCHORS = [];
      var PARENT;
      var _anchorIndex = -1;
      idx.parsed_content = DOMPurify.sanitize(snarkdown(idx.content));
      idx.parsed_description = DOMPurify.sanitize(snarkdown(idx.description));
      var due = null;
      if (idx.due) {
        var date = new Date(idx.due.date);
        due = ymd(date);
        if (idx.due.date.indexOf('T') === 10) {
          var datetime = new Date(idx.due.date);
          due = datetime.toLocaleString();
        }
      }
      $router.push(
        new Kai({
          name: 'taskPage',
          data: {
            title: 'taskPage',
            task: idx,
            due: due
          },
          templateUrl: document.location.origin + '/templates/task.html',
          mounted: function() {
            this.$router.setHeaderTitle(`#${idx.id}`);
            navigator.spatialNavigationEnabled = false;
            const VD = document.getElementById('__viewDefinition__');
            const len = ANCHORS.length;
            ANCHORS = [];
            var done = false, _idx = 0;
            PARENT = window.getComputedStyle(document.getElementById('__kai_router__'));
            const _anchors = VD.querySelectorAll('a')
            for (var x in _anchors) {
              if (_anchors[x].innerHTML !== "" && _anchors[x].innerHTML != null && _anchors[x].innerText.trim() != "" && _anchors[x].innerText != null) {
                ANCHORS.push(_anchors[x]);
                if (!done) {
                  if (len === 0 && isElementInViewport(_anchors[x], parseFloat(PARENT.marginTop), parseFloat(PARENT.marginBottom))) {
                    _anchors[x].classList.add('focus');
                    done = true;
                    _anchorIndex = _idx;
                  }
                }
                _idx++;
              }
            }
            if (ANCHORS[_anchorIndex])
              ANCHORS[_anchorIndex].classList.add('focus');
            this.methods.getVisibleAnchor();
            console.log(ANCHORS);
          },
          unmounted: function() {},
          methods: {
            isAnchorInViewPort: function(index) {
              if (ANCHORS[index] == null)
                return false;
              if (isElementInViewport(ANCHORS[index], parseFloat(PARENT.marginTop), parseFloat(PARENT.marginBottom))) {
                return true;
              }
              return false;
            },
            getVisibleAnchor: function() {
              const val = _anchorIndex === -1 ? -1 : 1;
              if (((_anchorIndex === -1) || (_anchorIndex === ANCHORS.length)) && !this.methods.isAnchorInViewPort(_anchorIndex - val)) {
                for (var x in ANCHORS) {
                  if (this.methods.isAnchorInViewPort(x)) {
                    _anchorIndex = parseInt(x);
                    break;
                  }
                }
              } else if (this.methods.isAnchorInViewPort(_anchorIndex - val) && !this.methods.isAnchorInViewPort(_anchorIndex)) {
                if (ANCHORS[_anchorIndex]) {
                  ANCHORS[_anchorIndex].classList.remove('focus');
                }
                ANCHORS[_anchorIndex - val].classList.add('focus');
                _anchorIndex = _anchorIndex - val;
              }
              this.methods.renderCenterText();
            },
            renderCenterText: function() {
              if (ANCHORS[_anchorIndex]) {
                this.$router.setSoftKeyCenterText("GOTO");
              } else {
                this.$router.setSoftKeyCenterText("");
              }
            }
          },
          softKeyText: { left: '', center: '', right: '' },
          softKeyListener: {
            left: function() {},
            center: function() {
              if (ANCHORS[_anchorIndex]) {
                window.open(ANCHORS[_anchorIndex].href);
              }
            },
            right: function() {}
          },
          dPadNavListener: {
            arrowUp: function() {
              const DOM = document.getElementById(this.id);
              DOM.scrollTop -= 20;
              this.scrollThreshold = DOM.scrollTop;
              if (ANCHORS[_anchorIndex]) {
                ANCHORS[_anchorIndex].classList.remove('focus');
                while (!this.methods.isAnchorInViewPort(_anchorIndex))  {
                  _anchorIndex -= 1;
                  if (ANCHORS[_anchorIndex] == null)
                    break
                }
              }
              if (ANCHORS[_anchorIndex])
                ANCHORS[_anchorIndex].classList.add('focus');
              this.methods.getVisibleAnchor();
            },
            arrowRight: function() {
              if (ANCHORS[_anchorIndex + 1] == null)
                return
              if (this.methods.isAnchorInViewPort(_anchorIndex + 1)) {
                ANCHORS[_anchorIndex].classList.remove('focus');
                ANCHORS[_anchorIndex + 1].classList.add('focus');
                _anchorIndex += 1;
              }
              this.methods.renderCenterText();
            },
            arrowDown: function() {
              const DOM = document.getElementById(this.id);
              DOM.scrollTop += 20;
              this.scrollThreshold = DOM.scrollTop;
              if (ANCHORS[_anchorIndex]) {
                ANCHORS[_anchorIndex].classList.remove('focus');
                while (!this.methods.isAnchorInViewPort(_anchorIndex))  {
                  _anchorIndex += 1;
                  if (ANCHORS[_anchorIndex] == null)
                    break
                }
              }
              if (ANCHORS[_anchorIndex])
                ANCHORS[_anchorIndex].classList.add('focus');
              this.methods.getVisibleAnchor();
            },
            arrowLeft: function() {
              if (ANCHORS[_anchorIndex - 1] == null)
                return
              if (this.methods.isAnchorInViewPort(_anchorIndex - 1)) {
                ANCHORS[_anchorIndex].classList.remove('focus');
                ANCHORS[_anchorIndex - 1].classList.add('focus');
                _anchorIndex -= 1;
              }
              this.methods.renderCenterText();
            },
          }
        })
      );
    } else {
      $router.pop();
    }
  }

  const addTaskPage = function($router, content=null, project_id=null, section_id=null, parent_id=null, order=null, label_ids=[], priority=null, due_string=null, due_date=null, due_datetime=null, due_lang=null, assignee=null, description=null) {
    
    $router.push(
      new Kai({
        name: 'addProjectPage',
        data: {
          content: content || '',
          description: description || '',
          priority: priority || 1,
          due_date_str: due_date ? ymd(due_date) : 'No',
          due_date: due_date || null,
          due_datetime_str: due_datetime ? due_datetime.toLocaleTimeString() : 'No',
          due_datetime: due_datetime || null,
        },
        verticalNavClass: '.addTaskNav',
        templateUrl: document.location.origin + '/templates/addTask.html',
        mounted: function() {
          this.$router.setHeaderTitle(content ? 'Update Task' : 'Add Task');
          navigator.spatialNavigationEnabled = false;
        },
        unmounted: function() {},
        methods: {
          setPriority: function() {
            var menu = [
              { "text": "Priority 1", "val": 1, "checked": false },
              { "text": "Priority 2", "val": 2, "checked": false },
              { "text": "Priority 3", "val": 3, "checked": false },
              { "text": "Priority 4", "val": 4, "checked": false }
            ];
            const idx = menu.findIndex((opt) => {
              return parseInt(opt.val) === parseInt(this.data.priority);
            });
            this.$router.showSingleSelector('Priority', menu, 'Select', (selected) => {
              this.setData({ priority: parseInt(selected.val) });
            }, 'Cancel', null, undefined, idx);
          },
          setDate: function() {
            var y,m,d;
            var date = this.data.due_date ? new Date(this.data.due_date) : new Date();
            //if (this.data.due_date) {
              y = date.getFullYear();
              m = date.getMonth() + 1;
              d = date.getDate();
            //}
            this.$router.showDatePicker(y, m, d, (dt) => {
              setTimeout(() => {
                this.setData({ due_date_str: ymd(dt), due_date: dt });
              }, 100);
            }, () => {
              this.setData({ due_date_str: 'No', due_date: null });
            });
          },
          setTime: function() {
            var HH,MM;
            var date = this.data.due_datetime ? new Date(this.data.due_datetime) : new Date();
            //if (this.data.due_datetime) {
              HH = date.getHours();
              MM = date.getMinutes();
            //}
            this.$router.showTimePicker(HH, MM, null, (dt) => {
              setTimeout(() => {
                this.setData({ due_datetime_str: dt.toLocaleTimeString(), due_datetime: dt });
              }, 100);
            }, () => {
              this.setData({ due_datetime_str: 'No', due_datetime: null });
            });
          }
        },
        softKeyText: { left: 'Back', center: 'SELECT', right: content ? 'Update' : 'Add' },
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
            var date = (this.data.due_date_str === 'No' ? null : this.data.due_date_str);
            var datetime = null;
            if (this.data.due_datetime_str !== 'No') {
              date = null;
              const d = new Date((this.data.due_date_str === 'No' ? new Date() : new Date(this.data.due_date)));
              dt = new Date(this.data.due_datetime);
              dt.setDate(d.getDate());
              dt.setMonth(d.getMonth());
              dt.setFullYear(d.getFullYear());
              dt.setMilliseconds(0);
              datetime = dt.toISOString().replace('.000Z', 'Z');
            }
            // console.log(this.data.content, project_id, section_id, parent_id, order, label_ids, this.data.priority, due_string, date, datetime, due_lang, assignee);
            if (window['TODOIST_API']) {
              this.$router.showLoading();
              var req;
              if (content) {
                req = window['TODOIST_API'].updateTask(project_id, this.data.content, label_ids, this.data.priority, due_string, date, datetime, due_lang, assignee, this.data.description);
              } else {
                req = window['TODOIST_API'].createTask(this.data.content, project_id, section_id, parent_id, order, label_ids, this.data.priority, due_string, date, datetime, due_lang, assignee, this.data.description);
              }
              req.then(() => {
                this.$router.showToast('Success');
                this.$router.pop();
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
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
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
            this.data.content = document.getElementById('content').value;
            this.data.description = document.getElementById('description').value;
          },
          arrowRight: function() {
            // this.navigateTabNav(-1);
          },
          arrowDown: function() {
            this.navigateListNav(1);
            this.data.content = document.getElementById('content').value;
            this.data.description = document.getElementById('description').value;
          },
          arrowLeft: function() {
            // this.navigateTabNav(1);
          },
        }
      })
    );
  }

  const tasksPage = function($router, project_id, parent_id, section_id) {

    var name = `${project_id}`;
    if (section_id) {
      const idx = state.getState('TODOIST_SYNC')['sections'].find((j) => {
        return j.id === section_id && j.is_deleted == 0;
      });
      if (idx) {
        name = `Section: ${idx.name}`;
      } else {
        $router.pop();
      }
    } else if (parent_id) {
      const idx = state.getState('TODOIST_SYNC')['items'].find((j) => {
        return j.id === parent_id && j.is_deleted == 0;
      });
      if (idx) {
        name = `Sub Task: ${idx.content}`;
      } else {
        $router.pop();
      }
    } else {
      const idx = state.getState('TODOIST_SYNC')['projects'].find((j) => {
        return j.id === project_id && j.is_deleted == 0;
      });
      if (idx) {
        name = `${idx.name}`;
      } else {
        $router.pop();
      }
    }

    $router.push(
      new Kai({
        name: 'tasksPage',
        data: {
          title: 'tasksPage',
          tasks: [],
          empty: true
        },
        templateUrl: document.location.origin + '/templates/tasks.html',
        verticalNavClass: '.taskListNav',
        mounted: function() {
          navigator.spatialNavigationEnabled = false;
          this.$router.setHeaderTitle(name);
          state.addStateListener('TODOIST_SYNC', this.methods.listenStateSync);
          var tasks = extractItems(state.getState('TODOIST_SYNC')['items'], project_id, parent_id, section_id);
          if ((tasks.length - 1) < this.verticalNavIndex) {
            this.verticalNavIndex--;
          }
          this.setData({tasks: tasks, empty: !(tasks.length > 0)});
          this.methods.toggleSoftKeyText(this.verticalNavIndex);
        },
        unmounted: function() {
          state.removeStateListener('TODOIST_SYNC', this.methods.listenStateSync);
        },
        methods: {
          listenStateSync: function(data) {
            if (section_id) {
              const idx = data['sections'].find((j) => {
              return j.id === section_id && j.is_deleted == 0;
              });
              if (!idx) {
                $router.pop();
              }
            } else if (parent_id) {
              const idx = data['items'].find((j) => {
              return j.id === parent_id && j.is_deleted == 0;
              });
              if (!idx) {
                $router.pop();
              }
            } else {
              const idx = data['projects'].find((j) => {
                return j.id === project_id && j.is_deleted == 0;
              });
              if (!idx) {
                $router.pop();
              }
            }
            var _tasks = extractItems(data['items'], project_id, parent_id, section_id);
            if ((_tasks.length - 1) < this.verticalNavIndex) {
              this.verticalNavIndex--;
            }
            this.setData({tasks: _tasks, empty: !(_tasks.length > 0)});
            this.methods.toggleSoftKeyText(this.verticalNavIndex);
            // console.log(this.data.tasks);
          },
          selected: function() {
            var task = this.data.tasks[this.verticalNavIndex];
            if (task) {
              taskPage($router, task.id);
            }
          },
          toggleSoftKeyText: function(idx) {
            setTimeout(() => {
              const page = $router.stack[$router.stack.length - 1];
              if (page) {
                if (page.name != 'tasksPage')
                  return;
              }
              if (this.data.tasks[idx]) {
                this.$router.setSoftKeyText('Add', 'VIEW', 'More');
              } else {
                this.$router.setSoftKeyText('Add', '', '');
              }
            }, 100);
          }
        },
        softKeyText: { left: '', center: '', right: '' },
        softKeyListener: {
          left: function() {
            addTaskPage(this.$router, null, project_id, section_id, parent_id);
          },
          center: function() {
            if (this.verticalNavIndex > -1) {
              const nav = document.querySelectorAll(this.verticalNavClass);
              nav[this.verticalNavIndex].click();
            }
          },
          right: function() {
            var task = this.data.tasks[this.verticalNavIndex];
            if (task) {
              var title = 'Options';
              var menu = [
                { "text": task.has_subtask ? "Open Sub Task" : "Add Sub Task" },
                { "text": "Edit Task" },
                { "text": "Task Completed" },
                { "text": "Delete Task" },
              ];
              this.$router.showOptionMenu('Options', menu, 'Select', (selected) => {
                setTimeout(() => {
                  if (selected.text === 'Open Sub Task') {
                    tasksPage($router, task.project_id, task.id, section_id);
                  } else if (selected.text === 'Add Sub Task') {
                    addTaskPage(this.$router, null, project_id, section_id, task.id);
                  } else if (selected.text === 'Edit Task') {
                    var date = null;
                    var datetime = null;
                    if (task.due) {
                      date = new Date(task.due.date);
                      if (task.due.date.indexOf('T') === 10) {
                        datetime = new Date(task.due.date);
                      }
                    }
                    addTaskPage($router, task.content, task.id, null, null, null, [], task.priority, null, date, datetime, null, null, task.description);
                  } else if (selected.text === 'Delete Task') {
                    setTimeout(() => {
                      this.$router.showDialog('Confirm', 'Are you sure to delete task #' + task.id + ' ?', null, 'Yes', () => {
                        this.$router.showLoading();
                        window['TODOIST_API'].deleteTask(task.id)
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
                        this.methods.toggleSoftKeyText(this.verticalNavIndex);
                      });
                    }, 100);
                  } else if (selected.text === 'Task Completed') {
                    setTimeout(() => {
                      this.$router.showDialog('Confirm', 'Are you sure task #' + task.id + '  was completed ?', null, 'Yes', () => {
                        this.$router.showLoading();
                        window['TODOIST_API'].deleteTask(task.id)
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
                        this.methods.toggleSoftKeyText(this.verticalNavIndex);
                      });
                    }, 100);
                  } else {
                    // console.log(selected, task);
                  }
                }, 101);
              }, () => {
                this.methods.toggleSoftKeyText(this.verticalNavIndex);
              }, 0);
            }
          }
        },
        dPadNavListener: {
          arrowUp: function() {
            if (this.verticalNavIndex === 0 || this.data.tasks.length === 0) {
              return;
            }
            this.navigateListNav(-1);
            this.methods.toggleSoftKeyText(this.verticalNavIndex);
          },
          arrowRight: function() {},
          arrowDown: function() {
            if (this.verticalNavIndex === (this.data.tasks.length - 1)  || this.data.tasks.length === 0) {
              return;
            }
            this.navigateListNav(1);
            this.methods.toggleSoftKeyText(this.verticalNavIndex);
          }
        }
      })
    );
  }

  const todayTasksPage = function($router) {

    $router.push(
      new Kai({
        name: 'todayTasksPage',
        data: {
          title: 'todayTasksPage',
          tasks: [],
          empty: true
        },
        templateUrl: document.location.origin + '/templates/tasks.html',
        verticalNavClass: '.taskListNav',
        mounted: function() {
          navigator.spatialNavigationEnabled = false;
          this.$router.setHeaderTitle('Today');
          state.addStateListener('TODOIST_SYNC', this.methods.listenStateSync);
          var tasks = extractTodayItems(state.getState('TODOIST_SYNC')['items']);
          if ((tasks.length - 1) < this.verticalNavIndex) {
            this.verticalNavIndex--;
          }
          this.setData({tasks: tasks, empty: !(tasks.length > 0)});
          this.methods.toggleSoftKeyText(this.verticalNavIndex);
        },
        unmounted: function() {
          state.removeStateListener('TODOIST_SYNC', this.methods.listenStateSync);
        },
        methods: {
          listenStateSync: function(data) {
            var _tasks = extractTodayItems(data['items']);
            if ((_tasks.length - 1) < this.verticalNavIndex) {
              this.verticalNavIndex--;
            }
            this.setData({tasks: _tasks, empty: !(_tasks.length > 0)});
            this.methods.toggleSoftKeyText(this.verticalNavIndex);
            // console.log(this.data.tasks);
          },
          selected: function() {
            var task = this.data.tasks[this.verticalNavIndex];
            if (task) {
              setTimeout(() => {
                taskPage($router, task.id);
              }, 100);
            }
          },
          toggleSoftKeyText: function(idx) {
            setTimeout(() => {
              const page = $router.stack[$router.stack.length - 1];
              if (page) {
                if (page.name != 'todayTasksPage')
                  return;
              }
              if (this.data.tasks[idx]) {
                this.$router.setSoftKeyText('', 'VIEW', 'More');
              } else {
                this.$router.setSoftKeyText('', '', '');
              }
            }, 100);
          }
        },
        softKeyText: { left: '', center: '', right: '' },
        softKeyListener: {
          left: function() {
            //addTaskPage(this.$router, null, project_id, section_id, parent_id);
          },
          center: function() {
            if (this.verticalNavIndex > -1) {
              const nav = document.querySelectorAll(this.verticalNavClass);
              nav[this.verticalNavIndex].click();
            }
          },
          right: function() {
            var task = this.data.tasks[this.verticalNavIndex];
            if (task) {
              var title = 'Options';
              var menu = [
                { "text": "Edit Task" },
                { "text": "Task Completed" },
                { "text": "Delete Task" },
              ];
              this.$router.showOptionMenu('Options', menu, 'Select', (selected) => {
                setTimeout(() => {
                  if (selected.text === 'Edit Task') {
                    var date = null;
                    var datetime = null;
                    if (task.due) {
                      date = new Date(task.due.date);
                      if (task.due.date.indexOf('T') === 10) {
                        datetime = new Date(task.due.date);
                      }
                    }
                    setTimeout(() => {
                      addTaskPage($router, task.content, task.id, null, null, null, [], task.priority, null, date, datetime, null, null, task.description);
                    }, 100);
                  } else if (selected.text === 'Delete Task') {
                    setTimeout(() => {
                      this.$router.showDialog('Confirm', 'Are you sure to delete task #' + task.id + ' ?', null, 'Yes', () => {
                        this.$router.showLoading();
                        window['TODOIST_API'].deleteTask(task.id)
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
                        this.methods.toggleSoftKeyText(this.verticalNavIndex);
                      });
                    }, 100);
                  } else if (selected.text === 'Task Completed') {
                    setTimeout(() => {
                      this.$router.showDialog('Confirm', 'Are you sure task #' + task.id + '  was completed ?', null, 'Yes', () => {
                        this.$router.showLoading();
                        window['TODOIST_API'].deleteTask(task.id)
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
                        this.methods.toggleSoftKeyText(this.verticalNavIndex);
                      });
                    }, 100);
                  } else {
                    // console.log(selected, task);
                  }
                }, 101);
              }, () => {
                this.methods.toggleSoftKeyText(this.verticalNavIndex);
              }, 0);
            }
          }
        },
        dPadNavListener: {
          arrowUp: function() {
            if (this.verticalNavIndex === 0 || this.data.tasks.length === 0) {
              return;
            }
            this.navigateListNav(-1);
            this.methods.toggleSoftKeyText(this.verticalNavIndex);
          },
          arrowRight: function() {},
          arrowDown: function() {
            if (this.verticalNavIndex === (this.data.tasks.length - 1)  || this.data.tasks.length === 0) {
              return;
            }
            this.navigateListNav(1);
            this.methods.toggleSoftKeyText(this.verticalNavIndex);
          }
        }
      })
    );
  }

  const sectionsPage = function($router, project_id) {

    const idx = state.getState('TODOIST_SYNC')['projects'].find((j) => {
      return j.id === project_id && j.is_deleted == 0;
    });
    var name = `${project_id}`;
    if (idx) {
      name = `${idx.name}`;
    } else {
      $router.pop();
    }

    $router.push(
      new Kai({
        name: 'sectionsPage',
        data: {
          title: 'sectionsPage',
          sections: [],
          empty: true
        },
        templateUrl: document.location.origin + '/templates/sections.html',
        verticalNavClass: '.sectionListNav',
        mounted: function() {
          navigator.spatialNavigationEnabled = false;
          this.$router.setHeaderTitle(name);
          state.addStateListener('TODOIST_SYNC', this.methods.listenStateSync);
          var sections = extractSections(state.getState('TODOIST_SYNC')['sections'], project_id);
          if ((sections.length - 1) < this.verticalNavIndex) {
            this.verticalNavIndex--;
          }
          this.setData({sections: sections, empty: !(sections.length > 0)});
          this.methods.toggleSoftKeyText(this.verticalNavIndex);
        },
        unmounted: function() {
          state.removeStateListener('TODOIST_SYNC', this.methods.listenStateSync);
        },
        methods: {
          listenStateSync: function(data) {
            const idx = data['projects'].find((j) => {
              return j.id === project_id && j.is_deleted == 0;
            });
            if (!idx) {
              $router.pop();
            }
            var _sections = extractSections(data['sections'], project_id);
            if ((_sections.length - 1) < this.verticalNavIndex) {
              this.verticalNavIndex--;
            }
            this.setData({sections: _sections, empty: !(_sections.length > 0)});
            this.methods.toggleSoftKeyText(this.verticalNavIndex);
            // console.log(this.data.sections);
          },
          selected: function() {
            var section = this.data.sections[this.verticalNavIndex];
            if (section) {
              tasksPage($router, section.project_id, null, section.id);
            }
          },
          toggleSoftKeyText: function(idx) {
            setTimeout(() => {
              const page = $router.stack[$router.stack.length - 1];
              if (page) {
                if (page.name != 'sectionsPage')
                  return;
              }
              if (this.data.sections[idx]) {
                this.$router.setSoftKeyText('Add', 'OPEN', 'More');
              } else {
                this.$router.setSoftKeyText('Add', '', '');
              }
            }, 100);
          }
        },
        softKeyText: { left: '', center: '', right: '' },
        softKeyListener: {
          left: function() {
            addSectionPage($router, project_id);
          },
          center: function() {
            if (this.verticalNavIndex > -1) {
              const nav = document.querySelectorAll(this.verticalNavClass);
              nav[this.verticalNavIndex].click();
            }
          },
          right: function() {
            var section = this.data.sections[this.verticalNavIndex];
            if (section) {
              var title = 'Options';
              var menu = [
                { "text": "Edit Section" },
                { "text": "Delete Section" }
              ];
              this.$router.showOptionMenu(title, menu, 'Select', (selected) => {
                setTimeout(() => {
                  if (selected.text === 'Edit Section') {
                    addSectionPage($router, section.id, section.name);
                  } else if (selected.text === 'Delete Section') {
                    setTimeout(() => {
                      this.$router.showDialog('Confirm', 'Are you sure to delete ' + section.name + ' ?', null, 'Yes', () => {
                        this.$router.showLoading();
                        window['TODOIST_API'].deleteSection(section.id)
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
                        this.methods.toggleSoftKeyText(this.verticalNavIndex);
                      });
                    }, 100);
                  }
                }, 101);
              }, () => {
                this.methods.toggleSoftKeyText(this.verticalNavIndex);
              }, 0);
            }
          }
        },
        dPadNavListener: {
          arrowUp: function() {
            if (this.verticalNavIndex === 0 || this.data.sections.length === 0) {
              return;
            }
            this.navigateListNav(-1);
            this.methods.toggleSoftKeyText(this.verticalNavIndex);
          },
          arrowRight: function() {},
          arrowDown: function() {
            if (this.verticalNavIndex === (this.data.sections.length - 1)  || this.data.sections.length === 0) {
              return;
            }
            this.navigateListNav(1);
            this.methods.toggleSoftKeyText(this.verticalNavIndex);
          }
        }
      })
    );
  }

  const addSectionPage = function($router, project_id, name) {
    $router.push(
      new Kai({
        name: name ? 'editSectionPage' : 'addSectionPage',
        data: {
          title: name || ''
        },
        verticalNavClass: '.addSectionNav',
        templateUrl: document.location.origin + '/templates/addSection.html',
        mounted: function() {
          navigator.spatialNavigationEnabled = false;
          this.$router.setHeaderTitle(name ? 'Edit Section' : 'Add Section');
        },
        unmounted: function() {},
        methods: {},
        softKeyText: { left: 'Back', center: 'SELECT', right: name ? 'Update' : 'Add' },
        softKeyListener: {
          left: function() {
            this.$router.pop();
          },
          center: function() {},
          right: function() {}
        },
        softKeyInputFocusText: { left: 'Back', center: '', right: name ? 'Update' : 'Add' },
        softKeyInputFocusListener: {
          left: function() {
            if (document.activeElement.tagName === 'INPUT') {
              document.activeElement.blur();
              this.$router.pop();
            }
          },
          center: function() {},
          right: function() {
            if (document.activeElement.tagName === 'INPUT') {
              if (window['TODOIST_API']) {
                this.$router.showLoading();
                var req;
                if (name) {
                  req = window['TODOIST_API'].updateSection(project_id, document.getElementById('section_title').value)
                } else {
                  req = window['TODOIST_API'].createSection(project_id, document.getElementById('section_title').value)
                }
                req.then(() => {
                  this.$router.showToast('Success');
                  document.activeElement.blur();
                  this.$router.pop();
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
          }
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
      navigator.spatialNavigationEnabled = false;
      this.$router.setHeaderTitle('K-Todoist');
      localforage.getItem('APP_VERSION')
      .then((v) => {
        if (v == null || v != APP_VERSION) {
          this.$router.showToast('Read about new updates');
          this.$router.push('helpSupportPage');
          localforage.setItem('APP_VERSION', APP_VERSION)
        } else {
          this.$state.addStateListener('TODOIST_SYNC', this.methods.listenStateSync);
          navigator.spatialNavigationEnabled = false;
          localforage.getItem('TODOIST_ACCESS_TOKEN')
          .then((TODOIST_ACCESS_TOKEN) => {
            if (TODOIST_ACCESS_TOKEN != null) {
              this.setData({ TODOIST_ACCESS_TOKEN: TODOIST_ACCESS_TOKEN });
              if (window['TODOIST_API'] == null) {
                window['TODOIST_API'] = new Todoist(TODOIST_ACCESS_TOKEN, onCompleteSync);
                window['TODOIST_API'].sync()
                .then(() => {
                  initTodoistWebsocket();
                });
              }
              localforage.getItem('TODOIST_SYNC')
              .then((TODOIST_SYNC) => {
                if (TODOIST_SYNC != null) {
                  this.$state.setState('TODOIST_SYNC', TODOIST_SYNC);
                  this.methods.listenStateSync(TODOIST_SYNC);
                }
              })
            } else {
              this.$router.setSoftKeyText('Menu', '', '');
            }
          });
        }
      });
    },
    unmounted: function() {
      this.$state.removeStateListener('TODOIST_SYNC', this.methods.listenStateSync);
    },
    methods: {
      sync: function() {
        if (window['TODOIST_API']) {
          this.$router.showLoading();
          window['TODOIST_API'].sync()
          .finally(() => {
            this.$router.hideLoading();
          })
        }
      },
      listenStateSync: function(data) {
        var projects = [];
        data.projects.forEach((i) => {
          if (i.is_deleted == 0) {
            i.color_hex = Todoist.Colors[i.color][1];
            projects.push(i);
          }
        });
        if (!this.$router.bottomSheet) {
          if (projects.length > 0) {
            this.$router.setSoftKeyText('Menu', 'Add Task', 'More');
          } else {
            this.$router.setSoftKeyText('Menu', 'Add Task', '');
          }
        }
        if ((projects.length - 1) < this.verticalNavIndex) {
          this.verticalNavIndex--;
        }
        projects.sort((a,b) => (a.child_order > b.child_order) ? 1 : ((b.child_order > a.child_order) ? -1 : 0));
        this.setData({ projects: projects, empty: (projects.length === 0 ? true : false) });
        // console.log(projects);
      },
      toggleSoftKeyText: function() {
        setTimeout(() => {
          const page = this.$router.stack[this.$router.stack.length - 1];
          if (page) {
            if (page.name != 'homepage')
              return;
          }
          if (!this.$router.bottomSheet) {
            if (this.data.projects.length > 0) {
              this.$router.setSoftKeyText('Menu', 'Add Task', 'More');
            } else {
              this.$router.setSoftKeyText('Menu', 'Add Task', '');
            }
          }
        }, 100);
      },
      deleteArticle: function() {},
      nextPage: function() {},
      selected: function() {
        var proj = this.data.projects[this.verticalNavIndex];
        if (proj) {
          tasksPage(this.$router, proj.id, null, null);
        }
      }
    },
    softKeyText: { left: 'Menu', center: 'Add Task', right: '' },
    softKeyListener: {
      left: function() {
        localforage.getItem('TODOIST_ACCESS_TOKEN')
        .then((res) => {
          var title = 'Menu';
          var menu = [
            { "text": "Help & Support" },
            { "text": "Login" },
            { "text": "Kill App" }
          ];
          if (res) {
            try {
              title = this.$state.getState('TODOIST_SYNC').user.email;
            } catch (e){}
            menu = [
              { "text": "Help & Support" },
              { "text": "Sync" },
              { "text": "Add Project" },
              { "text": "Today" },
              { "text": "Logout" },
              { "text": "Kill App" }
            ];
          }
          this.$router.showOptionMenu(title, menu, 'Select', (selected) => {
            setTimeout(() => {
              if (selected.text === 'Login') {
                loginPage(this.$router);
              } else if (selected.text === 'Add Project') {
                addProjectPage(this.$router);
              } else if (selected.text === 'Logout') {
                window['TODOIST_API'] = null;
                localforage.removeItem('TODOIST_ACCESS_TOKEN');
                localforage.removeItem('TODOIST_SYNC');
                this.verticalNavIndex = 0;
                this.setData({ TODOIST_ACCESS_TOKEN: null });
                this.setData({ projects: [], offset: -1 });
                this.$router.setSoftKeyText('Menu', '', '');
              } else if (selected.text === 'Sync') {
                this.methods.sync();
              } else if (selected.text === 'Help & Support') {
                this.$router.push('helpSupportPage');
              } else if (selected.text === 'Today') {
                todayTasksPage(this.$router);
              } else if (selected.text === 'Kill App') {
                window.close();
              }
            }, 101);
          }, () => {
            this.methods.toggleSoftKeyText();
          }, 0);
        })
        .catch((err) => {
          // console.log(err);
        });
      },
      center: function() {
        const obj = this.$state.getState('TODOIST_SYNC');
        if (obj['projects'] == null)
          return;
        const idx  = obj['projects'].findIndex((project) => {
          return project['inbox_project'];
        });
        if (idx === -1)
          return;
        addTaskPage(this.$router, null, obj['projects'][idx].id);
      },
      right: function() {
        var proj = this.data.projects[this.verticalNavIndex];
        if (proj) {
          var title = 'Options';
          var menu = [
            { "text": "Show Tasks" },
            { "text": "Show Sections" },
            { "text": "Edit Project" },
            { "text": "Delete Project" }
          ];
          this.$router.showOptionMenu(title, menu, 'Select', (selected) => {
            setTimeout(() => {
              if (selected.text === 'Show Tasks') {
                tasksPage(this.$router, proj.id, null, null);
              } else if (selected.text === 'Show Sections') {
                sectionsPage(this.$router, proj.id);
              } else if (selected.text === 'Edit Project') {
                addProjectPage(this.$router, proj.id, proj.name, proj.color, proj.is_favorite);
              } else if (selected.text === 'Delete Project') {
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
            }, 101);
          }, () => {
            this.methods.toggleSoftKeyText();
          }, 0);
        }
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
    // console.log(e);
  }

  IFRAME_TIMER = setInterval(() => {
    if (document.activeElement.tagName === 'IFRAME') {
      navigator.spatialNavigationEnabled = true;
    }
  }, 500);

  function displayKaiAds() {
    var display = true;
    if (window['kaiadstimer'] == null) {
      window['kaiadstimer'] = new Date();
    } else {
      var now = new Date();
      if ((now - window['kaiadstimer']) < 300000) {
        display = false;
      } else {
        window['kaiadstimer'] = now;
      }
    }
    console.log('Display Ads:', display);
    if (!display)
      return;
    getKaiAd({
      publisher: 'ac3140f7-08d6-46d9-aa6f-d861720fba66',
      app: 'k-todoist',
      slot: 'kaios',
      onerror: err => console.error(err),
      onready: ad => {
        ad.call('display')
        ad.on('close', () => {
          app.$router.hideBottomSheet();
          document.body.style.position = '';
        });
        ad.on('display', () => {
          app.$router.hideBottomSheet();
          document.body.style.position = '';
        });
      }
    })
  }

  displayKaiAds();

  document.addEventListener('visibilitychange', () => {
    if (app.$router.stack.length === 1) {
      setTimeout(() => {
        navigator.spatialNavigationEnabled = false;
      }, 500);
    }

    if (document.activeElement.tagName === 'IFRAME') {
      document.activeElement.blur();
    }
    
    if (document.visibilityState === 'hidden') {
      if (IFRAME_TIMER) {
        clearInterval(IFRAME_TIMER);
      }
    } else if (document.visibilityState === 'visible') {
      displayKaiAds();
      const browser = app.$router.stack[app.$router.stack.length - 1];
      if (browser.name === 'browser') {
        if (document.activeElement.tagName !== 'IFRAME') {
          navigator.spatialNavigationEnabled = true;
        }
      }
      IFRAME_TIMER = setInterval(() => {
        if (document.activeElement.tagName === 'IFRAME') {
          navigator.spatialNavigationEnabled = true;
        }
      }, 500);
    }
  });

});
