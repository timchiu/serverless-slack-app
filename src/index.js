'use strict';

// Include the serverless-slack bot framework
const slack = require('serverless-slack');

// Set up AWS interface
const AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-2'});
const sqs = new AWS.SQS({apiVersion: '2012-11-05'});
// const queueUrl = "https://sqs.us-east-2.amazonaws.com/578417282904/CROP.fifo";
const cropRequestQueueUrl = "https://sqs.us-east-2.amazonaws.com/578417282904/crop_requests";
const cropResponseQueueUrl = "https://sqs.us-east-2.amazonaws.com/578417282904/crop_responses";


// The function that AWS Lambda will call
exports.handler = slack.handler.bind(slack);


// Slash Command handler
slack.on('/greet', (msg, bot) => {
  let message = {
    text: "How would you like to greet the channel?",
    attachments: [{
      fallback: 'actions',
      callback_id: "greetings_click",
      actions: [
        { type: "button", name: "Wave", text: ":wave:", value: ":wave:" },
        { type: "button", name: "Hello", text: "Hello", value: "Hello" },
        { type: "button", name: "Howdy", text: "Howdy", value: "Howdy" },
        { type: "button", name: "Hiya", text: "Hiya", value: "Hiya" }
      ]
    }]
  };

  // ephemeral reply
  // bot.replyPrivate(message);
  bot.reply(message);
});


// Interactive Message handler
slack.on('greetings_click', (msg, bot) => {
  let message = {
    // selected button value
    text: msg.actions[0].value
  };

  // public reply
  bot.reply(message);
});


// Reaction Added event handler
slack.on('reaction_added', (msg, bot) => {
  bot.reply({
    text: ':wave:'
  });
});

const status = value => {
  return value ? ":sunny:" : ":rain_cloud:"
}

slack.on('/crophealth', (_msg, bot) => {
  const reqParams = {
    MessageBody: JSON.stringify({
      command: 'health_status'
    }),
    QueueUrl: cropRequestQueueUrl,
  };

  sqs.sendMessage(reqParams, (reqErr, reqData) => {
    if (reqErr) {
      bot.reply(`There was an error requesting CROP health status: ${reqErr}`);
    } else {
      const respParams = {
        QueueUrl: cropResponseQueueUrl,
        WaitTimeSeconds: 5
      };

      sqs.receiveMessage(respParams, (respErr, respData) => {
        if (respErr) {
          bot.reply({text: `There was an error receiveing CROP health status: ${respErr}`});  
        } else {
          if (respData.Messages.length > 0) {
            const retrievedMessage = respData.Messages[0].Body;
            const body = JSON.parse(retrievedMessage);
            const crop = status(body['app']['ok']);
            const dependencies = body['dependencies'];
            const mapper = status(dependencies['concept_mapper']['ok']);
            const geneticus = status(dependencies['geneticus']['ok']);
            const lims = status(dependencies['lims']['ok']);
            const vdb = status(dependencies['vdb']['ok']);
            const backoffice = status(dependencies['backoffice']['ok']);
            const library = status(dependencies['biomed_library']['ok']);
            const rabbitmq = status(dependencies['rabbitmq']['ok']);
            const moriarty = status(false);
            bot.reply({
              blocks: [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": `CROP: ${crop}`
                  }
                },
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": `Mapper: ${mapper}`
                  }
                },
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": `Geneticus: ${geneticus}`
                  }
                },
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": `LIMS: ${lims}`
                  }
                },
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": `VDB: ${vdb}`
                  }
                },
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": `Backoffice: ${backoffice}`
                  }
                },
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": `Library: ${library}`
                  }
                },
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": `RabbitMQ: ${rabbitmq}`
                  }
                },
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": `Moriarty: ${moriarty}`
                  },
                  "accessory": {
                    "type": "button",
                    "text": {
                      "type": "plain_text",
                      "text": "Report",
                      "emoji": true
                    },
                    "value": "click_me_123"
                  }
                }
              ]
            });

            // # did not work and kept giving errors.  commenting out for now.
            // const deleteParams = {
            //   QueueUrl: queueUrl,
            //   ReceiptHandle: respData.Messages[0].ReceiptHandle
            // };

            // sqs.deleteMessage(deleteParams, (deleteErr, _data) => {
            //   if (deleteErr) {
            //     bot.reply({text: `There was an error deleting messages from the queue: ${deleteErr}`});
            //   }
            // });

          }
        }
      });
    }
  });
});
