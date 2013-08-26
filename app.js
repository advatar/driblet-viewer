
/**
 * Module dependencies.
 */

var express = require('express')
   , http = require('http')
   , marked = require('marked')
   , request = require('request')
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

app.get('/', function(req,res) {
  git = req.query.git;
  if (git)
  {
    r = repo(git,function(rep,readme,appjs,indexejs,manifest) {
      //console.log(rep);
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

      //html = marked(readme);
      //console.log(marked(readme));
      html = marked(readme);
      screenshot = "https://raw.github.com/"+rep.full_name+"/"+rep.default_branch+"/screenshot.png";
      // now get the README.md as well as the mandatory manifest.yml    
      homepage = rep.homepage ? rep.homepage: "http://"+rep.name+".cfapps.io";

      res.render('index',{
        title:'Driblet',
        git:git,
        name:rep.name,
        description:rep.description,
        readme:html,
        screenshot:screenshot,
        appjs:appjs,
        manifest:manifest,
        indexejs:indexejs,
        homepage:homepage
      });
    }); 
  }
  else
    res.render('error',{title:'Error',msg:'Please supply a git url as a querystring, i.e ?url=https://github.com/advatar/bubbles',git:git})
});


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
  }, 
  function (err, response, body) 
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
        readme = new Buffer(content, 'base64').toString('ascii');      
        var appjsUrl = 'https://api.github.com/repos/' + user + '/' + repo+'/contents/app.js';

        request.get(appjsUrl, {
          json: true,
          qs: {
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET
          },
          headers: {'User-Agent': 'Node.js'}
        }, 
        function (err3, response3, body3) 
        {
          content = body3.content;
          appjs = new Buffer(content, 'base64').toString('ascii');

          var indexejsUrl = 'https://api.github.com/repos/' + user + '/' + repo+'/contents/views/index.ejs';    
          request.get(indexejsUrl, {
            json: true,
            qs: {
              client_id: process.env.GITHUB_CLIENT_ID,
              client_secret: process.env.GITHUB_CLIENT_SECRET
            },
            headers: {'User-Agent': 'Node.js'}
          }, 
          function (err4, response4, body4) 
          {
            content = body4.content;
            indexejs = new Buffer(content, 'base64').toString('ascii');

            var manifestUrl = 'https://api.github.com/repos/' + user + '/' + repo+'/contents/manifest.yml';
            request.get(manifestUrl, {
              json: true,
              qs: {
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET
              },
              headers: {'User-Agent': 'Node.js'}
            }, 
            function (err5, response5, body5) 
            {
              content = body5.content;
              manifest = new Buffer(content, 'base64').toString('ascii');
              callback(body,readme,appjs,indexejs,manifest);
            }); // 5
          }); // 4
        }); // 3
      }); // 2   
   } else {
    if (response && response.statusCode === 404) {
      console.log('Ooops got a dreaded 404');
    } else {
      console.log('GitHub fetch failed\n');
    }
  }
});

}

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
