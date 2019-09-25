'use strict';

// Include the serverless-slack bot framework
const slack = require('serverless-slack');

// Set up AWS interface
const AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-2'});
const sqs = new AWS.SQS({apiVersion: '2012-11-05'});
const queueUrl = "https://sqs.us-east-2.amazonaws.com/578417282904/CROP.fifo";
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
  bot.replyPrivate(message);
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

// Test sending a message to the queue
slack.on('/sqs-send', (_msg, bot) => {
  const params = {
    MessageBody: JSON.stringify({
      text: "This message was sent to SQS at the date and time attached.",
      date: (new Date()).toISOString()
    }),
    QueueUrl: queueUrl
  };

  sqs.sendMessage(params, (err, data) => {
    if (err) {
      bot.reply(`There was an error sending a message to SQS: ${err}`);
    } else {
      bot.reply(`Successfully added a message to the SQS queue! Message ID: ${data.MessageId}`);
    }
  });
});

// Test retrieving, then deleting, a message from the queue
slack.on('/sqs-get', (_msg, bot) => {
  const params = {
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 1,
    VisibilityTimeout: 0,
    WaitTimeSeconds: 0
  };

  sqs.receiveMessage(params, (err, data) => {
    if (err) {
      bot.reply(`There was an error retrieving a message from SQS: ${err}`);
    } else {
      if (!data.Message) {
        bot.reply("Nothing to process.");
        return;
      }
      const retrievedMessage = JSON.parse(data.Messages[0].Body);
      bot.reply(`Message retrieved: ${retrievedMessage}`);
      const deleteParams = {
        QueueUrl: queueUrl,
        ReceiptHandle: data.Messages[0].ReceiptHandle
      };
      sqs.deleteMessage(deleteParams, (err, _data) => {
        if (err) {
          bot.reply(`There was an error deleting a message from SQS: ${err}`);
        } else {
          bot.reply("Successfully deleted the last message from SQS.");
        }
      });
    }
  });
});

slack.on('/crophealth', (_msg, bot) => {
  const reqParams = {
    MessageBody: JSON.stringify({
      command: 'health_check'
    }),
    QueueUrl: cropRequestQueueUrl,
  }

  sqs.sendMessage(reqParams, (reqErr, reqData) => {
    if (reqErr) {
      bot.reply(`There was an error requesting CROP health status: ${reqErr}`);
    } else {
      const respParams = {
        QueueUrl: cropResponseQueueUrl,
        WaitTimeSeconds: 20
      }

      sqs.receiveMessage(respParams, (respErr, respData) => {
        if (respErr) {
          bot.reply(`There was an error receiveing CROP health status: ${respErr}`);
        } else {
          for (let message of respData.Messages) {
            if (message.messageId === reqData.messageId) {
              bot.reply(message.Body);
              return;
            }
          }
        }
      });
    }
  });
});
