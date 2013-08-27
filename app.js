
/**
 * Module dependencies.
 */

var express = require('express')
   , http = require('http')
   , marked = require('marked')
   , request = require('request')
   , path = require('path')
   , sa = require("superagent")
   , passport = require('passport')
   , util = require('util')
   , GitHubStrategy = require('passport-github').Strategy;

var  GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ? process.env.GITHUB_CLIENT_ID: "21963c60466945ca92c9"; 
var  GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ? process.env.GITHUB_CLIENT_SECRET : "84979c36b91181d74f24103ade8b3074cc686dba";

console.log(GITHUB_CLIENT_ID);
console.log(GITHUB_CLIENT_SECRET);

var config = process.env.CONFIG;

var CF_UAA= (config && config.uaa) ? config.uaa : "http://uaa.run.pivotal.io";
var CF_API= (config && config.api) ? config.api :"http://api.run.pivotal.io";
var CF_USERNAME = (config && config.username) ? config.username :"johan@sellstrom.me";
var CF_PASSWORD = (config && config.password) ? config.password :"kv1stfr1tt";


passport.serializeUser(function(user, done) {
  console.log("passport.serializeUser",user);
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  console.log("passport.deserializeUser",obj);
  done(null, obj);
});

passport.use(new GitHubStrategy({
    clientID: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
    callbackURL: process.env.GITHUB_CLIENT_ID ? "http://driblet.cfapps.io/auth/github/callback" : "http://localhost:2000/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () 
    {
      // To keep the example simple, the user's GitHub profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the GitHub account with a user record in your database,
      // and return that user instead.
      return done(null, profile);
    });
  }
));

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 2345);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.session({ secret: 'keyboard cat' }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(express.methodOverride());
  //app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/pushandgo', ensureAuthenticated, function(req, res) {
  sa
  .get(CF_API+'/v2/apps')
  .set('Authorization', req.session.token)
  .set('Accept', 'application/json')
  .end(function(error, result){
    if (!error)
    {
      applications = JSON.parse(result.text).resources;
      console.log("applications",applications);
    }
    else
      console.error(error);
  }); 
});

app.get('/account', ensureAuthenticated, function(req, res){
  res.render('account', { user: req.user ,cfuser: req.session.user_id});
});

app.get('/github-login', function(req, res){
  res.render('login', { user: req.user ,cfuser: req.session.user_id});
});

app.get('/github-error', function(req, res){
  
  res.render('error',{msg:'Could not login to github', user: req.user,cfuser: req.session.user_id })
});

app.get('/auth/github',
  passport.authenticate('github'),
  function(req, res){
    // The request will be redirected to GitHub for authentication, so this
    // function will not be called.
  });

app.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: '/github-error' }),
  function(req, res) {
    res.redirect('/github-account');
  });

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

function ensureAuthenticated(req, res, next) {

  /*if (!req.isAuthenticated())
  res.redirect('/github-login');
  else */ if (!req.session.user_id)
   res.redirect('/cloudfoundry-login');
  else
    return next(); 
}


// Cloudfoundry auth

app.get('/cloudfoundry-login',function(req,res){
  getToken(
  {username: CF_USERNAME, password: CF_PASSWORD},
  function (error,result) {
    if (!error) {
      req.session.access_token = "bearer "+JSON.parse(result.text).access_token;
      //console.log(req.session.access_token);
      // get user_id
      sa
      .get(CF_UAA+'/userinfo')
      .set('Authorization', req.session.access_token)
      .set('Accept', 'application/json')
      .end(function(error, result){
        if (!error)
        {
          req.session.user_id = req.session.user_id=JSON.parse(result.text).user_id;
          res.cookie('access_token', req.session.access_token, { maxAge: 900000, httpOnly: false});
          res.cookie('user_id', req.session.user_id, { maxAge: 900000, httpOnly: false});
          console.log("req.session.access_token",req.session.access_token);
          console.log("req.session.user_id",req.session.user_id);
          res.redirect('/edit/'+req.session.git);
        }
        else
        {
          res.send(error);
        }      
      });  
    }
    else
    {
      res.send(error);
    }
  })
});

app.get('/cloudfoundry-logout', function (req, res) {
  delete req.session.user_id;
  delete req.session.access_token;
  delete req.cookies;
  res.redirect('/');
});  


function getToken(options, cont) {
  var body = {
    response_type: "token",
    grant_type: "password",
    username: options.username,
    password: options.password
  };
  sa.post(CF_UAA+'/oauth/token')
    .send(body)
    .type('form')
    .set('Accept', 'application/json')
    .set('Authorization', 'Basic Y2Y6')
    .end(function (error, res) {
      cont(error,res);
    })
}


app.get('/', function (req, res, next) {

  d = req.query.d ? req.query.d: req.query.git ? "":"hello-cloud";
  r = req.query.r ? req.query.r: req.query.git ? "":"Use this very simple driblet as a starting point and build something more interesing";
  git = req.query.git ? req.query.git : "https://github.com/advatar/hello-cloud";
  req.session.git = git;
  var re = /github\.com\/([\w\-\.]+)\/([\w\-\.]+)/i;
  var parsedUrl = re.exec(git.replace(/\.git$/, ''));
  if (parsedUrl)
  {
    var user = parsedUrl[1];
    var repo = parsedUrl[2];
    var branch = parsedUrl[3] ? "/"+parsedUrl[3] : "/master";
    var screenshot = "https://raw.github.com/"+user+"/"+repo+branch+"/screenshot.png";
    res.render('index',{
        title:'Driblet',
        git: git,
        name: repo,
        description: d,
        readme: r,
        homepage: 'http://'+repo+'.cfapps.io',
        screenshot: screenshot,
        appjs:"",
        manifest:"",
        indexejs:"",
        user: req.user ,
        cfuser: req.session.user_id,
        edit: false
    });
  } 
  else
  {
    res.render('error',{msg:'Could not parse '+git, user: req.user ,cfuser: req.session.user_id})
  }
});


app.get(/(edit)\/(.+)/, ensureAuthenticated, function(req, res){

  git = req.params[1] ? req.params[1]: req.session.git ? req.session.git : "https://github.com/advatar/hello-cloud";

  if (git)
  {
    r = repo(req, res,git,function(err,rep,readme,appjs,indexejs,manifest) {
      if (!err) {
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
        console.log(html);
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
          homepage:homepage,
          user: req.user ,
          cfuser: req.session.user_id,
          edit: req.session.user_id
        });
      } else
          res.render('error',{msg:err, user: req.user, cfuser: req.session.user_id })
    }); 
  }
  else
  {
    res.render('error',{msg:'no git url', user: req.user, cfuser: req.session.user_id })
  }
});
 
function repo(req, res,url,callback) {
  var re = /github\.com\/([\w\-\.]+)\/([\w\-\.]+)/i;
  var parsedUrl = re.exec(url.replace(/\.git$/, ''));
  // only return components from github for now, later we need to implement gitlab as well
  if (!parsedUrl) {
    console.error("Could not parse a valid github url");
    callback("Could not parse a valid github url");
  }

  var user = parsedUrl[1];
  var repo = parsedUrl[2];
  var apiUrl = 'https://api.github.com/repos/' + user + '/' + repo;

  request.get(apiUrl, {
    json: true,
    qs: {
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET
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
      callback('GitHub fetch failed, api limit exceeded\n');

    }
    else if (!err && response.statusCode === 200) {

      var readmeUrl = 'https://api.github.com/repos/' + user + '/' + repo+'/readme';

      request.get(readmeUrl, {
        json: true,
        qs: {
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET
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
            client_id: GITHUB_CLIENT_ID,
            client_secret: GITHUB_CLIENT_SECRET
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
              client_id: GITHUB_CLIENT_ID,
              client_secret: GITHUB_CLIENT_SECRET
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
                client_id: GITHUB_CLIENT_ID,
                client_secret: GITHUB_CLIENT_SECRET
              },
              headers: {'User-Agent': 'Node.js'}
            }, 
            function (err5, response5, body5) 
            {
              content = body5.content;
              manifest = new Buffer(content, 'base64').toString('ascii');
              callback(null,body,readme,appjs,indexejs,manifest);
            }); // 5
          }); // 4
        }); // 3
      }); // 2   
     } else {
      if (response && response.statusCode === 404) {
        console.error('Ooops got a dreaded 404 for ',git);
        callback('Ooops got a dreaded 404 for ',git);
      } else {
        console.error('GitHub fetch failed ',body.message);
        callback('GitHub fetch failed' + body.message);
      }
    }
  });
}

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
