const bcrypt = require('bcrypt');
const saltRounds = 10;
const Validator = require('validatorjs');

const moment = require('moment')

var User = require('../model/user.model');
const nodemailer = require('nodemailer');

var Contact = require('../model/contact.model');
var Email = require('../model/email.model');
var Message = require('../model/message.model'); 
var Setting = require('../model/setting.model'); 
const telnyxHelper = require('../helper/telnyx.helper');
const twilioHelper = require('../helper/twilio.helper');

const remoteVersion = 'https://raw.githubusercontent.com/0perationPrivacy/VoIP/main/version.md';
const currentVersion = process.env.BASE_URL + 'version.md'; // read from local file version.md

var jwt = require('jsonwebtoken');

const Speakeasy = require("speakeasy");
const QRCode = require("qrcode");

exports.login = async (req, res) => {
    let rules = {
        email: 'required',
        password: 'required'
    };
    let validation = new Validator(req.body, rules);
    if(validation.passes()){
        var email = req.body.email.toLowerCase()
        var userData = {email:{ $eq: email}};
        var user = await User.findOne(userData);
        //res.send(user);
        if(user){
            var checkpassword = bcrypt.compareSync(req.body.password, user.password);
            if(checkpassword){
                var obj = {id:user.id,email:user.email,name:user.name};
                var token = jwt.sign(obj, process.env.COOKIE_KEY);
                user.token = token;
                user.save();      
                if(user.mfa && user.mfa === 'true'){
                    res.send({status:'mfa', message:'user data!', data:user, token:token});
                }else{
                    res.send({status:'true', message:'user data!', data:user, token:token});
                }   
                
                return;
            }else{
                res.status(401).json({status:'false',message:'Unauthorized Access!'});
            }
        }else{
            res.status(401).json({status:'false',message:'Unauthorized Access!'});
        }
    }else{
        res.status(419).send({status: false, errors:validation.errors, data: []});
    }
};
//otp-verify
exports.otpVerify = async (req, res) => {
    var userData = {_id:{$eq: req.body.user}};
    var user = await User.findOne(userData);
    if(user){
        var verifyData = Speakeasy.totp.verify({
            secret: user.mfa_token,
            encoding: 'base32',
            token: req.body.verification_code
        });
        if(verifyData){
            res.status(200).json({status:'true',data:[],message:'verified successfully!'});
        }else{
            res.status(400).json({status:'false',message:'Please enter valid verification code!'});
        }
    }
};

exports.register = async (req, res) => {
    let rules = {
        email: 'required',
        password: 'required|between:6,100'
    };
    let validation = new Validator(req.body, rules);
    if(validation.passes()){
        var email = req.body.email.toLowerCase()
        var checkEmail = await User.findOne({email: {$eq: email}});
        if(checkEmail){
            var errors = {errors: {email:['Username already exists!']}};
            res.status(400).send({status: false, errors:errors, data: []});
        }else{
            const hash = bcrypt.hashSync(req.body.password, saltRounds);
            var userData = {name:email, email:email,password:hash};
            var saveUser = await User.create(userData);
            res.send({status:true, message:'User created successfully!', data:saveUser});
        }
    }else{
        res.status(419).send({status: false, errors:validation.errors, data: []});
    }
};

exports.getSignUpOption = async (req, res) => {
    var signup = process.env.SIGNUPS;
    if(signup){
        res.send({status:true, message:'signup option!', data:signup});
    }else{
        res.status(400).send({status: false, errors:'signup not avilables', data: []}); 
    }
    // res.send({status:true, message:'user created successfully!', data:saveUser});
};

exports.getVersionOption = (req, res) => {
    var request = require('request');
    request.get(currentVersion, async function (error, response, body) {
       // console.log(body);
       // console.log(error);
        if (!error && response.statusCode == 200) {
            if(isNaN(body)){
                res.send({status:true, message:'Not a numeric value!', data:'v0.0'});
            }else{
                res.send({status:true, message:'version defined.', data:`v${body}`});
            }
        }else{
            res.send({status:true, message:'version file not found!', data:'v0.0'});
        }
    });
};
exports.checkDirectoryName = (req, res) => {
    var dir = process.env.APPDIRECTORY
    if(dir){
        if(dir === req.body.dirname){
            res.send({status:true, message:'APPDIRECTORY Matched!', data:{status:'true'}});
        } else {
            res.send({status:true, message:'APPDIRECTORY Mismatch!', data:{status:'false'}});
        }
    }else{
        res.send({status:true, message:'APPDIRECTORY not defined!', data:{status:'nodir'}});
    }
};
exports.getUpdateVersion = (req, res) => {
    var request = require('request');
    request.get(remoteVersion, async function (error, response, body) {
        if (!error && response.statusCode == 200) {
            if(isNaN(body)){
                res.send({update: 'false'});
            }else{
                // var curruntv = process.env.APP_VERSION
                // curruntv = curruntv.replace("v", "").replace("-beta", "");
                // console.log(body)
                //console.log(currentVersion)
                request.get(currentVersion, async function (error, response, body2) {
                    if (!error && response.statusCode == 200) {
                        if(isNaN(body2)){
                            res.send({update: 'false'});
                        }else{
                            if(body2 < body){
                                res.send({update: 'true'});
                            }else{
                                res.send({update: 'false'});
                            }
                        }
                    }else{
                        res.send({update: 'false'});
                    }
                });
                // console.log(currentVersion)
                // var current
            }
        }else{
            res.send({update: 'false'});
        }
    });
};

exports.updateUserName = async (req, res) => {
    let rules = {
        email: 'required',
    };
    let validation = new Validator(req.body, rules);
    if(validation.passes()){
        var user = await User.findOne({ email: { $eq: req.body.email } , _id: { $ne: req.user.id } });
        if(user){
            res.status(400).json({status:'false',message:'username already exists!'});
        }else{
            // var checkUser = await User.findById(req.user.id);
            var checkUser = await User.findOne({_id: { $eq: req.user.id }});
            if(checkUser){
                checkUser.email = req.body.email
                checkUser.name = req.body.email
                var saveEmail = await checkUser.save()
                res.send({status:true, message:'username updated successfully!', data:checkUser});
            }else{
                res.status(400).json({status:'false',message:'User not found!'});
            }
        }
    }else{
        res.status(419).send({status: false, errors:validation.errors, data: []});
    }
}

exports.getUser = async (req, res) => {
    var user = await User.findOne({ _id: { $eq: req.user.id } });
    if(user){
        res.status(200).json({status:'true',data:user,message:'user get!'});
    }else{
        res.status(400).json({status:'false',message:'User not found!'});
    }
}

exports.saveMfa = async (req, res) => {
    let rules = {
        status: 'required',
    };
    let validation = new Validator(req.body, rules);
    if(validation.passes()){
        var user = await User.findOne({ _id: { $eq: req.user.id } });
        if(user){
            if(req.body.status === 'true'){
                if(req.body.qr === 'true'){
                    const secretCode = Speakeasy.generateSecret({
                        name: `Operation Privacy (${req.user.email})`,
                      });
                      user.mfa_token = secretCode.base32
                      await user.save()
                      var image = await QRCode.toDataURL(secretCode.otpauth_url)
                      var respnse = {
                          image: image,
                          secret: secretCode.base32
                      }
                      res.send(respnse);
                }else{
                    var verifyData = Speakeasy.totp.verify({
                        secret: user.mfa_token,
                        encoding: 'base32',
                        token: req.body.code
                    });
                    if(verifyData){
                        user.mfa = 'true'
                        await user.save()
                        res.status(200).json({status:'true',data:user,message:'verified successfully!'});
                    }else{
                        res.status(400).json({status:'false',message:'Please enter valid verification code!'});
                    }
                }
            }else{
                user.mfa = req.body.status
                await user.save()
                res.status(200).json({status:'true',data:user,message:'status saved successfully!'});
            }
        }else{
            // var checkUser = await User.findById(req.user.id);
            var checkUser = await User.findOne({_id: { $eq: req.user.id }});
            if(checkUser){
                checkUser.email = req.body.email
                checkUser.name = req.body.email
                var saveEmail = await checkUser.save()
                res.send({status:true, message:'username updated successfully!', data:checkUser});
            }else{
                res.status(400).json({status:'false',message:'User not found!'});
            }
        }
    }else{
        res.status(419).send({status: false, errors:validation.errors, data: []});
    }
}

exports.updatePassword = async (req, res) => {
    let rules = {
        old_password: 'required',
        password: 'required',
        c_password: 'required'
    };
    let validation = new Validator(req.body, rules);
    if(validation.passes()){
        // var checkUser = await User.findById(req.user.id);
        var checkUser = await User.findOne({_id: { $eq: req.user.id }});
        if(checkUser){
            var checkpassword = bcrypt.compareSync(req.body.old_password, checkUser.password);
            if(checkpassword){
                const hash = bcrypt.hashSync(req.body.password, saltRounds);
                checkUser.password = hash
                var saveEmail = await checkUser.save()
                res.send({status:true, message:'Password updated successfully!', data:checkUser});
            }else{
                res.status(400).json({status:'false',message:'Please enter a valid old password!'});
            }
        }else{
            res.status(400).json({status:'false',message:'User not found!'});
        }
    }else{
        res.status(419).send({status: false, errors:validation.errors, data: []});
    }
}
exports.passwordVerify = async(req, res) => {
    let rules = {
        password: 'required'
    };
    let validation = new Validator(req.body, rules);
    if(validation.passes()){
        var checkUser = await User.findOne({_id: {$eq: req.user.id }});
        if(checkUser){
            var checkpassword = bcrypt.compareSync(req.body.password, checkUser.password);
            if(checkpassword){
                res.send({status:'true', message:'Password checked!', data:checkUser});
            }else{
                res.status(400).json({status:'false',message:'please enter valid password!'});
            }
        }else{
            res.status(400).json({status:'false',message:'User not found!'});
        }
    }else{
        res.status(400).send({status: false, message:'Password required!', data: []});
    }
}
exports.checkPassword = async (req, res) => {
    let rules = {
        password: 'required'
    };
    let validation = new Validator(req.body, rules);
    if(validation.passes()){
        // var checkUser = await User.findById(req.user.id);
        var checkUser = await User.findOne({_id: {$eq: req.user.id }});
        if(checkUser){
            var checkpassword = bcrypt.compareSync(req.body.password, checkUser.password);
            if(checkpassword){
                var response = await deleteAllAccountData(req.user.id)
                res.send(response)
                // res.send({status:'true', message:'Password checked!', data:checkUser});
            }else{
                res.status(400).json({status:'false',message:'Please enter a valid password!'});
            }
        }else{
            res.status(400).json({status:'false',message:'User not found!'});
        }
    }else{
        res.status(400).send({status: false, message:'Password required!', data: []});
    }
}

const deleteAllAccountData = (userid) => {
    // console.log(outboundProfileid)
    return new Promise(async (resolve,reject) =>  {
        try{
            var response = {status:'true', message:'Password checked!', data:[]}; 
            await Contact.deleteMany({user: userid});
            await Email.deleteMany({user: userid});
            await Message.deleteMany({user: userid});
            var settings =await Setting.find({user:{ $eq: userid}});
            for(var i = 0; i < settings.length; i++) {
                try{
                    if(settings[i].type === 'telnyx'){
                        if(settings[i].api_key && settings[i].sid){
                            await telnyxHelper.updatePhoneNumber(settings[i].api_key, settings[i].sid)
                        }
                        if(settings[i].api_key && settings[i].sip_id){
                            await telnyxHelper.deleteSIPApp(settings[i].api_key, settings[i].sip_id)
                        }
                        if(settings[i].api_key && settings[i].telnyx_outbound){
                            await telnyxHelper.deleteOutboundVoice(settings[i].api_key, settings[i].telnyx_outbound)
                        }
                        if(settings[i].api_key && settings[i].telnyx_twiml){
                            await telnyxHelper.deleteTexmlApp(settings[i].api_key, settings[i].telnyx_twiml)
                        }
                        if(settings[i]._id && settings[i].sid){
                            await telnyxHelper.emptyMessageProfile(settings[i].api_key, settings[i].sid)
                        }
                        if(settings[i].api_key && settings[i].setting){
                            await telnyxHelper.deleteMessageProfile(settings[i].api_key, settings[i].setting)
                        }
                    }
                    if(settings[i].type === 'twilio' && settings[i].twilio_sid && settings[i].twilio_token){
                        if(settings[i].app_key){
                            await twilioHelper.removeAPIKey(settings[i].twilio_sid, settings[i].twilio_token, settings[i].app_key)
                        }
                        if(settings[i].app_key){
                            await twilioHelper.deleteTwiml(settings[i].twilio_sid, settings[i].twilio_token, settings[i].twiml_app)
                        }
                        if(settings[i].app_key){
                            await twilioHelper.unlinkNumber(settings[i].twilio_sid, settings[i].twilio_token, settings[i].sid)
                        }
                    }
                }catch(error){

                }
            }
            await Setting.deleteMany({user: userid});
            await User.deleteOne({_id: userid});
            resolve(response);
        }catch(error){
            console.log(error)
            resolve(false);
        }
    });
}



