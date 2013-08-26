
/**
 * Module dependencies.
 */

var express = require('express')
   , http = require('http')
   , base64 = require('base64')
   , marked = require('marked')
   , path = require('path');

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 2000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', function(req,res){
  git = req.query.git;
  if (git)
  {
    r = repo(git,function(rep,readme){
      marked.setOptions({
  gfm: true,
  highlight: function (code, lang, callback) {
    pygmentize({ lang: lang, format: 'html' }, code, function (err, result) {
      if (err) return callback(err);
      callback(null, result.toString());
    });
  },
  tables: true,
  breaks: false,
  pedantic: false,
  sanitize: true,
  smartLists: true,
  smartypants: false,
  langPrefix: 'lang-'
});
      html = marked(readme);
      // now get the README.md as well as the mandatory manifest.yml
      res.render('index',{title:'Driblet',git:git,name:rep.name,description:rep.description,readme:html});
    }); 
  }
  else
    res.render('error',{title:'Error',msg:'Please supply a git url as a querystring, i.e ?url=https://github.com/advatar/bubbles',git:git})
});

var request = require('request');

function repo(url,callback) {
  var re = /github\.com\/([\w\-\.]+)\/([\w\-\.]+)/i;
  var parsedUrl = re.exec(url.replace(/\.git$/, ''));

  // only return components from github for now, later we need to implement gitlab as well
  if (!parsedUrl) {
    console.err("Could not parse a valid github url");
  }

  var user = parsedUrl[1];
  var repo = parsedUrl[2];
  var apiUrl = 'https://api.github.com/repos/' + user + '/' + repo;

  request.get(apiUrl, {
    json: true,
    qs: {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET
    },
    headers: {
      'User-Agent': 'Node.js'
    }
  }, function (err, response, body) 
  {
    if (!err && body && /API Rate Limit Exceeded/.test(body.message)) {
      apiLimitExceeded = true;
      console.err('GitHub fetch failed, api limit exceeded\n');
    }
    else if (!err && response.statusCode === 200) {
      var readmeUrl = 'https://api.github.com/repos/' + user + '/' + repo+'/readme';
      request.get(readmeUrl, {
        json: true,
        qs: {
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET
        },
        headers: {'User-Agent': 'Node.js'}
      }, 
      function (err2, response2, body2) 
      {
        content = body2.content;
        // this has to be decoded
        callback(body,base64.decode(content));
  /*
      var readmeContentUrl = 'https://api.github.com/repos/' + user + '/' + repo+'/contents/'+readme_path;

      console.log(readmeContentUrl);

      request.get(readmeContentUrl, {
        json: true,
        qs: {
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET
        },
        headers: {'User-Agent': 'Node.js'}
      }, 
      function (err3, response3, body3) {
        console.log("README ",body3);

        callback(body,body3);
      });

*/

      });    
  } else {
    if (response && response.statusCode === 404) {
      // uncomment to get a list of registry items pointing
      // to non-existing repos
      //console.log(el.name + '\n' + el.url + '\n');

      // don't fail just because the repo doesnt exist
      // instead just return `undefined` and filter it out later
      console.err('Ooops got a dreaded 404');
      deferred.resolve();
    } else {
      console.err('GitHub fetch failed\n' + err + '\n' + body + '\n' + response);
    }
  }
});

}


http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
