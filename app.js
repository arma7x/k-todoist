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
            // console.log('WS', TODOIST_SYNC.user.websocket_url);
            const ws = new WebSocket(TODOIST_SYNC.user.websocket_url);
            ws.onclose = function() {
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
                      console.log(data.type);
                    }
                  }
                } catch (e) {}
              }
            }
            ws.onopen = function() {
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
      console.log('onCompleteSync');
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

  function extractItems(items, project_id, parent_id, section_id) {
    var _tasks = [];
    items.forEach((i) => {
      if (i.project_id === project_id && i.parent_id === parent_id && i.section_id === section_id && i.is_deleted == 0) {
        const idx = items.findIndex((j) => {
          return j.parent_id === i.id;
        });
        i.has_subtask = false;
        i.parsed_content = snarkdown(i.content);
        if (idx > -1) {
          i.has_subtask = true;
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
    template: '<div style="padding:4px;"><style>.kui-software-key{height:0px}</style><b>NOTICE</b><br>Save button within the https://getpocket.com/explore is not working. Please use `Save to GetPocket` to save website you visited to your GetPocket account<br><br><b>Reader View</b><br>Parses html text (usually news and other articles) and returns title, author, main image and text content without nav bars, ads, footers, or anything that isn\'t the main body of the text. Analyzes each node, gives them a score, and determines what\'s relevant and what can be discarded<br><br> <b>Shortcut Key</b><br>* 1 Zoom-out<br> * 2 Reset zoom<br> * 3 Zoom-in<br> * 5 Hide/Show menu</div>',
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
      console.log(idx);
    } else {
      $router.pop();
    }
  }

  const addTaskPage = function($router, content=null, project_id=null, section_id=null, parent_id=null, order=null, label_ids=[], priority=null, due_string=null, due_date=null, due_datetime=null, due_lang=null, assignee=null) {
    
    $router.push(
      new Kai({
        name: 'addProjectPage',
        data: {
          content: content || '',
          priority: priority || 1,
          due_date_str: due_date ? ymd(due_date) : 'No',
          due_date: due_date || null,
          due_datetime_str: due_datetime ? due_datetime.toLocaleTimeString() : 'No',
          due_datetime: due_datetime || null,
        },
        verticalNavClass: '.addTaskNav',
        templateUrl: document.location.origin + '/templates/addTask.html',
        mounted: function() {
          this.$router.setHeaderTitle(content ? 'Update Project' : 'Add Project');
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
            var date = new Date(this.data.due_date);
            if (this.data.due_date) {
              y = date.getFullYear();
              m = date.getMonth() + 1;
              d = date.getDate();
            }
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
            var date = new Date(this.data.due_datetime);
            if (this.data.due_datetime) {
              HH = date.getHours();
              MM = date.getMinutes();
            }
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
              datetime = dt.toISOString();
            }
            console.log(this.data.content, project_id, section_id, parent_id, order, label_ids, this.data.priority, due_string, date, datetime, due_lang, assignee);
            if (window['TODOIST_API']) {
              this.$router.showLoading();
              var req;
              if (content) {
                req = window['TODOIST_API'].updateTask(project_id, this.data.content, label_ids, this.data.priority, due_string, date, datetime, due_lang, assignee);
              } else {
                req = window['TODOIST_API'].createTask(this.data.content, project_id, section_id, parent_id, order, label_ids, this.data.priority, due_string, date, datetime, due_lang, assignee);
              }
              req.then(() => {
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
            this.data.content = document.getElementById('content').value;
          },
          arrowRight: function() {
            // this.navigateTabNav(-1);
          },
          arrowDown: function() {
            this.navigateListNav(1);
            this.data.content = document.getElementById('content').value;
          },
          arrowLeft: function() {
            // this.navigateTabNav(1);
          },
        }
      })
    );
  }

  const tasksPage = function($router, project_id, parent_id, section_id) {

    var name = `Project: ${project_id}`;
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
        name = `Project: ${idx.name}`;
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
            console.log(this.data.tasks);
          },
          selected: function() {
            var task = this.data.tasks[this.verticalNavIndex];
            if (task) {
              taskPage($router, task.id);
            }
          },
          toggleSoftKeyText: function(idx) {
            setTimeout(() => {
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
              var subtask = [];
              if (task.has_subtask) {
                subtask = [{ "text": "Open Sub Task" }]
              }
              var title = 'Options';
              var menu = [
                { "text": "Add Sub Task" },
                { "text": "Edit Task" },
                { "text": "Task Completed" },
                { "text": "Delete Task" },
              ];
              this.$router.showOptionMenu('Options', subtask.concat(menu), 'Select', (selected) => {
                setTimeout(() => {
                  if (selected.text === 'Open Sub Task') {
                    tasksPage($router, task.project_id, task.id, null);
                  } else if (selected.text === 'Edit Task') {
                    var date = null;
                    var datetime = null;
                    if (task.due) {
                      date = new Date(task.due.date);
                      if (task.due.date.indexOf('T') === 10) {
                        datetime = new Date(task.due.date);
                      }
                    }
                    addTaskPage($router, task.content, task.id, null, null, null, [], task.priority, null, date, datetime, null, null);
                  } else if (selected.text === 'Delete Task') {
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
                  } else if (selected.text === 'Task Completed') {
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
                  } else {
                    console.log(selected, task);
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
    var name = `Project: ${project_id}`;
    if (idx) {
      name = `Project: ${idx.name}`;
    } else {
      $router.pop();
    }

    $router.push(
      new Kai({
        name: 'sectionsPagee',
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
            console.log(this.data.sections);
          },
          selected: function() {
            var section = this.data.sections[this.verticalNavIndex];
            if (section) {
              tasksPage($router, section.project_id, null, section.id);
            }
          },
          toggleSoftKeyText: function(idx) {
            setTimeout(() => {
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
      this.$router.setHeaderTitle('Projects');
      this.$state.addStateListener('TODOIST_SYNC', this.methods.listenStateSync);
      navigator.spatialNavigationEnabled = false;
      localforage.getItem('TODOIST_ACCESS_TOKEN')
      .then((TODOIST_ACCESS_TOKEN) => {
        if (TODOIST_ACCESS_TOKEN != null) {
          this.setData({ TODOIST_ACCESS_TOKEN: TODOIST_ACCESS_TOKEN });
          if (window['TODOIST_API'] == null) {
            window['TODOIST_API'] = new Todoist(TODOIST_ACCESS_TOKEN, onCompleteSync);
            this.methods.sync();
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
    },
    unmounted: function() {
      this.$state.removeStateListener('TODOIST_SYNC', this.methods.listenStateSync);
    },
    methods: {
      sync: function() {
        if (window['TODOIST_API']) {
          //this.$router.showToast('Sync');
          this.$router.showLoading();
          window['TODOIST_API'].sync()
          .then((res) => {
            //this.$router.showToast('Done Sync');
          })
          .catch(() => {
            //this.$router.showToast('Error Sync');
          })
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
        if (projects.length > 0) {
          this.$router.setSoftKeyText('Menu', 'TASKS', 'More');
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
              this.$router.setSoftKeyText('Menu', 'TASKS', 'More');
            } else {
              this.$router.setSoftKeyText('Menu', '', '');
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
    softKeyText: { left: 'Menu', center: '', right: '' },
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
              } else if (selected.text ===  'Help & Support') {
                this.$router.push('helpSupportPage');
              }
            }, 101);
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
        var proj = this.data.projects[this.verticalNavIndex];
        if (proj) {
          var title = 'Options';
          var menu = [
            { "text": "Show Sections" },
            { "text": "Edit Project" },
            { "text": "Delete Project" }
          ];
          this.$router.showOptionMenu(title, menu, 'Select', (selected) => {
            setTimeout(() => {
              if (selected.text === 'Show Sections') {
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
    //console.log(e);
  }

  initTodoistWebsocket();

  document.addEventListener('visibilitychange', () => {
    console.log(document.visibilityState)
  });

  getKaiAd({
    publisher: 'ac3140f7-08d6-46d9-aa6f-d861720fba66',
    app: 'k-todoist',
    slot: 'kaios',
    onerror: err => console.error(err),
    onready: ad => {
      //ad.call('display')
    }
  })

});
