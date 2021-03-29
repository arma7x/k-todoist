const Todoist = (function() {

  function Todoist(options, onComplete) {
    this.syncData = {};
    this.onComplete = onComplete != null && typeof onComplete === "function" ? onComplete : null;
    this.init(options);
  }

  Todoist.prototype.init = function(options, onComplete) {
    this.accessToken = options.access_token;
    this.tokenType = options.token_type;
  }

  Todoist.Colors = {
    30: ['Berry Red', '#b8255f'],
    31: ['Red', '#db4035'],
    32: ['Orange', '#ff9933'],
    33: ['Yellow', '#fad000'],
    34: ['Olive Green', '#afb83b'],
    36: ['Green', '#299438'],
    37: ['Mint Green', '#6accbc'],
    38: ['Teal', '#158fad'],
    39: ['Sky Blue', '#14aaf5'],
    40: ['Light Blue', '#96c3eb'],
    41: ['Blue', '#4073ff'],
    42: ['Grape', '#884dff'],
    43: ['Violet', '#af38eb'],
    44: ['Lavender', '#eb96eb'],
    35: ['Lime Green', '#7ecc49'],
    45: ['Magenta', '#e05194'],
    46: ['Salmon', '#ff8d85'],
    47: ['Charcoal', '#808080'],
    48: ['Grey', '#b8b8b8'],
    49: ['Taupe', '#ccac93']
  }

  Todoist.uuidv4 = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  Todoist.xhr = function(method, url, data={}, query={}, headers={}) {
    return new Promise((resolve, reject) => {
      var xhttp = new XMLHttpRequest({ mozSystem: true });
      var _url = new URL(url);
      for (var y in query) {
        _url.searchParams.set(y, query[y]);
      }
      url = _url.origin + _url.pathname + '?' + _url.searchParams.toString();
      xhttp.onreadystatechange = function() {
        if (this.readyState == 4) {
          if (this.status >= 200 && this.status <= 299) {
            try {
              const response = JSON.parse(xhttp.response);
              resolve({ raw: xhttp, response: response});
            } catch (e) {
              resolve({ raw: xhttp, response: xhttp.responseText});
            }
          } else {
            try {
              const response = JSON.parse(xhttp.response);
              reject({ raw: xhttp, response: response});
            } catch (e) {
              reject({ raw: xhttp, response: xhttp.responseText});
            }
          }
        }
      };
      xhttp.open(method, url, true);
      for (var x in headers) {
        xhttp.setRequestHeader(x, headers[x]);
      }
      if (Object.keys(data).length > 0) {
        xhttp.send(JSON.stringify(data));
      } else {
        xhttp.send();
      }
    });
  }

  // GET https://api.todoist.com/sync/v8/sync
  Todoist.prototype.sync = function(sync_token) {
    function deepCopy(_res, _syncData, type) {
      var new_ids = [];
      _res.response[type].forEach((i) => {
        new_ids.push(i.id);
      });
      if (_syncData[type] != null) {
        _syncData[type].forEach((i) => {
          if (new_ids.indexOf(i.id) === -1) {
            _res.response[type].push(i);
          }
        });
      }
    }

    var data = {};
    var query = {
      token: this.accessToken,
      sync_token: sync_token || this.syncData.sync_token || '*',
      resource_types: '["all"]'
    };
    var result = Todoist.xhr('GET', `https://api.todoist.com/sync/v8/sync`, data, query, {});
    result.then((res) => {
      ['projects', 'items', 'notes', 'project_notes', 'sections', 'labels', 'filters'].forEach((i) => {
        deepCopy(res, this.syncData, i);
      });
      if (this.onComplete != null) {
        this.onComplete(JSON.parse(JSON.stringify(Object.assign(this.syncData, res.response))));
      }
    });
    return result;
  }

  // GET https://api.todoist.com/rest/v1/projects
  Todoist.prototype.getAllProject = function() {
    return Todoist.xhr('GET', 'https://api.todoist.com/rest/v1/projects', {}, {}, {'Authorization': `${this.tokenType} ${this.accessToken}`});
  }

  // POST https://api.todoist.com/rest/v1/projects
  Todoist.prototype.createProject = function(name, parent_id, color, favorite) {
    // * name      String  Yes Name of the project.
    // * parent_id Integer No Parent project ID.
    // * color     Integer No      A numeric ID representing the color of the project icon. Refer to Todoist.Colors
    // * favorite  Boolean No      Whether the project is a favorite (a true or false value).
    var data = {};
    if (name != null) {
      data.name = name;
    } else {
      return Promise.reject('Name is require');
    }
    if (parent_id != null) {
      data.parent_id = parent_id;
    }
    if (color != null && Todoist.Colors[color] != null) {
      data.color = color;
    }
    if (favorite != null && typeof favorite === "boolean") {
      data.favorite = favorite;
    }
    return Todoist.xhr('POST', 'https://api.todoist.com/rest/v1/projects', data, {}, {
      'Authorization': `${this.tokenType} ${this.accessToken}`,
      'Content-Type':'application/json',
      'X-Request-Id': Todoist.uuidv4()
    });
  }

  // GET https://api.todoist.com/rest/v1/projects/${id}
  Todoist.prototype.getProject = function(id) {
    return Todoist.xhr('GET', `https://api.todoist.com/rest/v1/projects/${id}`, {}, {}, {'Authorization': `${this.tokenType} ${this.accessToken}`});
  }

  // POST https://api.todoist.com/rest/v1/projects/${id}
  Todoist.prototype.updateProject = function(id, name, color, favorite) {
    // name String No	Name of the project.
    // color Integer No	A numeric ID representing the color of the project icon. Refer to the id column in the Colors guide for more info.
    // favorite Boolean
    var data = {};
    if (name != null) {
      data.name = name;
    }
    if (color != null && Todoist.Colors[color] != null) {
      data.color = color;
    }
    if (favorite != null && typeof favorite === "boolean") {
      data.favorite = favorite;
    }
    return Todoist.xhr('POST', `https://api.todoist.com/rest/v1/projects/${id}`, data, {}, {
      'Authorization': `${this.tokenType} ${this.accessToken}`,
      'Content-Type':'application/json',
      'X-Request-Id': Todoist.uuidv4()
    });
  }

  // DELETE https://api.todoist.com/rest/v1/projects/${id}
  Todoist.prototype.deleteProject = function(id) {
    return Todoist.xhr('DELETE', `https://api.todoist.com/rest/v1/projects/${id}`, {}, {}, {'Authorization': `${this.tokenType} ${this.accessToken}`});
  }

  // GET https://api.todoist.com/rest/v1/projects/${id}/collaborators
  Todoist.prototype.getAllCollaborators = function(id) {
    return Todoist.xhr('GET', `https://api.todoist.com/rest/v1/projects/${id}/collaborators`, {}, {}, {'Authorization': `${this.tokenType} ${this.accessToken}`});
  }

  // GET https://api.todoist.com/rest/v1/sections?project_id=${id}
  Todoist.prototype.getAllSections = function(id) {
    return Todoist.xhr('GET', `https://api.todoist.com/rest/v1/sections`, {}, {'project_id': id}, {'Authorization': `${this.tokenType} ${this.accessToken}`});
  }

  // POST https://api.todoist.com/rest/v1/sections
  Todoist.prototype.createSection = function(project_id, name, order) {
    // name String Yes	Section name
    // project_id Integer Yes	Project ID this section should belong to
    // order Integer No	Order among other sections in a project
    var data = {};
    if (name != null) {
      data.name = name;
    } else {
      return Promise.reject('Name is require');
    }
    if (project_id != null) {
      data.project_id = project_id;
    } else {
      return Promise.reject('Project ID is require');
    }
    if (order != null) {
      data.order = order;
    }
    return Todoist.xhr('POST', `https://api.todoist.com/rest/v1/sections`, data, {}, {
      'Authorization': `${this.tokenType} ${this.accessToken}`,
      'Content-Type':'application/json'
    });
  }

  // GET https://api.todoist.com/rest/v1/sections/7025
  Todoist.prototype.getSection = function(id) {
    return Todoist.xhr('GET', `https://api.todoist.com/rest/v1/sections/${id}`, {}, {}, {'Authorization': `${this.tokenType} ${this.accessToken}`});
  }

  // POST https://api.todoist.com/rest/v1/sections/7025
  Todoist.prototype.updateSection = function(id, name) {
    // name String Yes	Section name
    var data = {};
    if (name != null) {
      data.name = name;
    } else {
      return Promise.reject('Name is require');
    }
    return Todoist.xhr('POST', `https://api.todoist.com/rest/v1/sections/${id}`, data, {}, {
      'Authorization': `${this.tokenType} ${this.accessToken}`,
      'Content-Type':'application/json'
    });
  }

  // DELETE https://api.todoist.com/rest/v1/sections/7025
  Todoist.prototype.deleteSection = function(id) {
    return Todoist.xhr('DELETE', `https://api.todoist.com/rest/v1/sections/${id}`, {}, {}, {'Authorization': `${this.tokenType} ${this.accessToken}`});
  }

  // GET https://api.todoist.com/rest/v1/tasks
  Todoist.prototype.getAllActiveTask = function(filter = {}) {
    // * project_id Integer           No	Filter tasks by project ID.
    // * label_id   Integer           No	Filter tasks by label.
    // * filter     String            No	Filter by any supported filter.
    // * lang       String            No	IETF language tag defining what language filter is written in, if differs from default English.
    // * ids        Array of integers No	A list of the task IDs to retrieve, this should be a comma separated list.
    var query = {};
    if (filter.project_id != null) {
      query.project_id = filter.project_id;
    }
    if (filter.label_id != null) {
      query.label_id = filter.label_id;
    }
    if (filter.filter != null) {
      query.filter = filter.filter;
    }
    if (filter.lang != null) {
      query.lang = filter.lang;
    }
    if (filter.ids != null) {
      query.ids = filter.ids;
    }
    return Todoist.xhr('GET', `https://api.todoist.com/rest/v1/tasks`, {}, query, {'Authorization': `${this.tokenType} ${this.accessToken}`});
  }

  // POST https://api.todoist.com/rest/v1/tasks
  Todoist.prototype.createTask = function(content, project_id=null, section_id=null, parent_id=null, order=null, label_ids=[], priority=null, due_string=null, due_date=null, due_datetime=null, due_lang=null, assignee=null) {
    // * content      String            Yes Task content. This value may contain markdown-formatted text and hyperlinks. Details on markdown support can be found in the Text Formatting article in the Help Center.
    // * project_id   Integer           No  Task project ID. If not set, task is put to user's Inbox.
    // * section_id   Integer           No  ID of section to put task into.
    // * parent_id    Integer           No  Parent task ID.
    // * order        Integer           No  Non-zero integer value used by clients to sort tasks under the same parent.
    // * label_ids    Array of Integers No  IDs of labels associated with the task.
    // * priority     Integer           No  Task priority from 1 (normal) to 4 (urgent).
    // * due_string   String            No  Human defined task due date (ex.: "next Monday", "Tomorrow"). Value is set using local (not UTC) time.
    // * due_date     String            No  Specific date in YYYY-MM-DD format relative to user’s timezone.
    // * due_datetime String            No  Specific date and time in RFC3339 format in UTC.
    // * due_lang     String            No  2-letter code specifying language in case due_string is not written in English.
    // * assignee     Integer           No  The responsible user ID (if set, and only for shared tasks).
    var data = {};
    if (content != null) {
      data.content = content;
    } else {
      return Promise.reject('Content is require');
    }
    if (project_id != null) {
      data.project_id  = project_id;
    }
    if (parent_id != null) {
      data.parent_id  = parent_id;
    }
    if (order != null) {
      data.order = order;
    }
    if (label_ids != null) {
      data.label_ids = label_ids;
    }
    if (priority != null) {
      data.priority = priority;
    }
    if (due_string != null) {
      data.due_string = due_string;
    }
    if (due_date != null) {
      data.due_date = due_date;
    }
    if (due_datetime != null) {
      data.due_datetime = due_datetime;
    }
    if (due_lang != null) {
      data.due_lang = due_lang;
    }
    if (assignee != null) {
      data.assignee = assignee;
    }
    return Todoist.xhr('POST', `https://api.todoist.com/rest/v1/tasks`, data, {}, {
      'Authorization': `${this.tokenType} ${this.accessToken}`,
      'Content-Type':'application/json',
      'X-Request-Id': Todoist.uuidv4()
    });
  }

  // GET https://api.todoist.com/rest/v1/tasks/2995104339
  Todoist.prototype.getActiveTask = function(id) {
    return Todoist.xhr('GET', `https://api.todoist.com/rest/v1/tasks/${id}`, {}, {}, {'Authorization': `${this.tokenType} ${this.accessToken}`});
  }

  // POST https://api.todoist.com/rest/v1/tasks/2995104339
  Todoist.prototype.updateTask = function(id, content, label_ids=[], priority=null, due_string=null, due_date=null, due_datetime=null, due_lang=null, assignee=null) { // TODO
    // * content        String            Yes Task content. This value may contain markdown-formatted text and hyperlinks. Details on markdown support can be found in the Text Formatting article in the Help Center.
    // * label_ids      Array of Integers No  IDs of labels associated with the task.
    // * priority       Integer           No  Task priority from 1 (normal) to 4 (urgent).
    // * due_string     String            No  Human defined task due date (ex.: "next Monday", "Tomorrow"). Value is set using local (not UTC) time.
    // * due_date       String            No  Specific date in YYYY-MM-DD format relative to user’s timezone.
    // * due_datetime   String            No  Specific date and time in RFC3339 format in UTC.
    // * due_lang       String            No  2-letter code specifying language in case due_string is not written in English.
    // * assignee       Integer           No  The responsible user ID (if set, and only for shared tasks).
    var data = {};
    if (id == null) {
      return Promise.reject('Task ID is require');
    }
    if (content != null) {
      data.content = content;
    } else {
      return Promise.reject('Content is require');
    }
    if (label_ids != null) {
      data.label_ids = label_ids;
    }
    if (priority != null) {
      data.priority = priority;
    }
    if (due_string != null) {
      data.due_string = due_string;
    }
    if (due_date != null) {
      data.due_date = due_date;
    }
    if (due_datetime != null) {
      data.due_datetime = due_datetime;
    }
    if (due_lang != null) {
      data.due_lang = due_lang;
    }
    if (assignee != null) {
      data.assignee = assignee;
    }
    return Todoist.xhr('POST', `https://api.todoist.com/rest/v1/tasks/${id}`, data, {}, {
      'Authorization': `${this.tokenType} ${this.accessToken}`,
      'Content-Type':'application/json',
      'X-Request-Id': Todoist.uuidv4()
    });
  }

  // POST https://api.todoist.com/rest/v1/tasks/2995104339/close
  Todoist.prototype.closeTask = function(id) {
    return Todoist.xhr('POST', `https://api.todoist.com/rest/v1/tasks/${id}/close`, {}, {}, {'Authorization': `${this.tokenType} ${this.accessToken}`});
  }

  // POST https://api.todoist.com/rest/v1/tasks/2995104339/reopen
  Todoist.prototype.reopenTask = function(id) {
    return Todoist.xhr('POST', `https://api.todoist.com/rest/v1/tasks/${id}/reopen`, {}, {}, {'Authorization': `${this.tokenType} ${this.accessToken}`});
  }

  // DELETE https://api.todoist.com/rest/v1/tasks/2995104339
  Todoist.prototype.deleteTask = function(id) {
    return Todoist.xhr('DELETE', `https://api.todoist.com/rest/v1/tasks/${id}`, {}, {}, {'Authorization': `${this.tokenType} ${this.accessToken}`});
  }

  // POST https://api.todoist.com/sync/v8/completed/get_all?project_id=2261572164
  Todoist.prototype.getCompletedTasks = function(id) {
    var data = {};
    var query = {token: this.accessToken};
    if (id != null) {
      query.project_id = id
    }
    return Todoist.xhr('POST', `https://api.todoist.com/sync/v8/completed/get_all`, data, query, {});
  }

  // GET https://api.todoist.com/rest/v1/comments?task_id=2995104339
  Todoist.prototype.getAllComments = function(project_id, task_id) {
    var query = {};
    if (project_id != null) {
      query.project_id = project_id;
    } else if (task_id != null) {
      query.task_id = task_id;
    } else {
      return Promise.reject('Task/Project ID is require');
    }
    return Todoist.xhr('GET', `https://api.todoist.com/rest/v1/comments`, {}, query, {'Authorization': `${this.tokenType} ${this.accessToken}`});
  }

  // POST https://api.todoist.com/rest/v1/comments
  Todoist.prototype.createComment = function(project_id, task_id, content, attachment) {
    // * task_id    Integer Yes (or project_id) Comment's task ID (for task comments).
    // * project_id Integer Yes (or task_id)    Comment's project ID (for project comments).
    // * content    String  Yes                 Comment content. This value may contain markdown-formatted text and hyperlinks. Details on markdown support can be found in the Text Formatting article in the Help Center.
    // * attachment Object  No                  Object for attachment object.
    var data = {};
    if (project_id != null) {
      data.project_id = project_id;
    } else  if (task_id != null) {
      data.task_id = task_id;
    } else {
      return Promise.reject('Task/Project ID is require');
    }
    if (content != null) {
      data.content = content;
    } else {
      return Promise.reject('Content is require');
    }
    if (attachment != null) {
      // data.attachment = attachment; // TODO
    }
    return Todoist.xhr('POST', `https://api.todoist.com/rest/v1/comments`, data, {}, {
      'Authorization': `${this.tokenType} ${this.accessToken}`,
      'Content-Type':'application/json',
      'X-Request-Id': Todoist.uuidv4()
    });
  }

  // GET https://api.todoist.com/rest/v1/comments/2992679862
  Todoist.prototype.getComment = function(id) {
    return Todoist.xhr('GET', `https://api.todoist.com/rest/v1/comments/${id}`, {}, {}, {'Authorization': `${this.tokenType} ${this.accessToken}`});
  }

  // POST https://api.todoist.com/rest/v1/comments/2992679862
  Todoist.prototype.updateComment = function(id, content) {
    // content String Yes New content for the comment. This value may contain markdown-formatted text and hyperlinks. Details on markdown support can be found in the Text Formatting article in the Help Center.
    var data = {};
    if (content != null) {
      data.content = content;
    } else {
      return Promise.reject('Content is require');
    }
    return Todoist.xhr('POST', `https://api.todoist.com/rest/v1/comments/${id}`, data, {}, {
      'Authorization': `${this.tokenType} ${this.accessToken}`,
      'Content-Type':'application/json',
      'X-Request-Id': Todoist.uuidv4()
    });
  }

  // DELETE https://api.todoist.com/rest/v1/comments/2992679862
  Todoist.prototype.deleteComment = function(id) {
    return Todoist.xhr('DELETE', `https://api.todoist.com/rest/v1/comments/${id}`, {}, {}, {'Authorization': `${this.tokenType} ${this.accessToken}`});
  }

  // GET https://api.todoist.com/rest/v1/labels
  Todoist.prototype.getAllLabels = function() {
    return Todoist.xhr('GET', `https://api.todoist.com/rest/v1/labels`, {}, {}, {'Authorization': `${this.tokenType} ${this.accessToken}`});
  }

  // POST https://api.todoist.com/rest/v1/labels
  Todoist.prototype.createLabel = function(name, order, color, favorite) {
    // * name     String  Yes Name of the label.
    // * order    Integer No  Label order.
    // * color    Integer No  A numeric ID representing the color of the label icon. Refer to the id column in the Colors guide for more info.
    // * favorite Boolean No  Whether the label is a favorite (a true or false value).
    var data = {};
    if (name != null) {
      data.name = name;
    } else {
      return Promise.reject('Name is require');
    }
    if (order != null) {
      data.order = order;
    }
    if (color != null && Todoist.Colors[color] != null) {
      data.color = color;
    }
    if (favorite != null) {
      data.favorite = favorite;
    }
    return Todoist.xhr('POST', `https://api.todoist.com/rest/v1/labels`, data, {}, {
      'Authorization': `${this.tokenType} ${this.accessToken}`,
      'Content-Type':'application/json',
      'X-Request-Id': Todoist.uuidv4()
    });
  }

  // GET https://api.todoist.com/rest/v1/labels/2156154810
  Todoist.prototype.getLabel = function(id) {
    return Todoist.xhr('GET', `https://api.todoist.com/rest/v1/labels/${id}`, {}, {}, {'Authorization': `${this.tokenType} ${this.accessToken}`});
  }

  // POST https://api.todoist.com/rest/v1/labels/2156154810
  Todoist.prototype.updateLabel = function(id, name, order, color, favorite) {
    // * name     String  Yes Name of the label.
    // * order    Integer No  Label order.
    // * color    Integer No  A numeric ID representing the color of the label icon. Refer to the id column in the Colors guide for more info.
    // * favorite Boolean No  Whether the label is a favorite (a true or false value).
    var data = {};
    if (name != null) {
      data.name = name;
    }
    if (order != null) {
      data.order = order;
    }
    if (color != null && Todoist.Colors[color] != null) {
      data.color = color;
    }
    if (favorite != null) {
      data.favorite = favorite;
    }
    return Todoist.xhr('POST', `https://api.todoist.com/rest/v1/labels/${id}`, data, {}, {
      'Authorization': `${this.tokenType} ${this.accessToken}`,
      'Content-Type':'application/json',
      'X-Request-Id': Todoist.uuidv4()
    });
  }

  // DELETE https://api.todoist.com/rest/v1/labels/2156154810
  Todoist.prototype.deleteLabel = function(id) {
    return Todoist.xhr('DELETE', `https://api.todoist.com/rest/v1/labels/${id}`, {}, {}, {'Authorization': `${this.tokenType} ${this.accessToken}`});
  }

  return Todoist;

})();
