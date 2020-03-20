// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { generate_uuid } from "rhea-promise";
import { isTokenCredential, TokenCredential } from "@azure/core-amqp";
import {
  ServiceBusClientOptions,
  createConnectionContextForTokenCredential,
  createConnectionContextForConnectionString
} from "./constructorHelpers";
import { ConnectionContext } from "./connectionContext";
import { ClientEntityContext } from "./clientEntityContext";
import { ClientType } from "./client";
import { SenderImpl, Sender } from "./sender";
import { GetSessionReceiverOptions } from "./models";
import { Receiver, ReceiverImpl, SubscriptionRuleManagement } from "./receivers/receiver";
import { SessionReceiver, SessionReceiverImpl } from "./receivers/sessionReceiver";
import { ReceivedMessageWithLock, ReceivedMessage } from "./serviceBusMessage";

/**
 * A client that can create Sender instances for sending messages to queues and
 * topics as well as Receiver instances to receive messages from queus and subscriptions.
 */
export class ServiceBusClient {
  private _connectionContext: ConnectionContext;

  /**
   *
   * @param connectionString A connection string for Azure Service Bus.
   * NOTE: this connection string can contain an EntityPath, which is ignored.
   * @param options Options for the service bus client.
   */
  constructor(connectionString: string, options?: ServiceBusClientOptions);
  /**
   *
   * @param host The hostname of your Azure Service Bus.
   * @param tokenCredential A valid TokenCredential for Service Bus or a
   * Service Bus entity.
   * @param options Options for the service bus client.
   */
  constructor(
    hostName: string,
    tokenCredential: TokenCredential,
    options?: ServiceBusClientOptions
  );
  constructor(
    connectionStringOrHostName1: string,
    tokenCredentialOrServiceBusOptions2?: TokenCredential | ServiceBusClientOptions,
    options3?: ServiceBusClientOptions
  ) {
    if (isTokenCredential(tokenCredentialOrServiceBusOptions2)) {
      const hostName: string = connectionStringOrHostName1;
      const tokenCredential: TokenCredential = tokenCredentialOrServiceBusOptions2;
      const options: ServiceBusClientOptions | undefined = options3;

      this._connectionContext = createConnectionContextForTokenCredential(
        tokenCredential,
        hostName,
        options
      );
    } else {
      const connectionString: string = connectionStringOrHostName1;
      const options: ServiceBusClientOptions | undefined = tokenCredentialOrServiceBusOptions2;

      this._connectionContext = createConnectionContextForConnectionString(
        connectionString,
        options
      );
    }
  }

  /**
   * Creates a receiver for an Azure Service Bus queue.
   *
   * @param queueName The name of the queue to receive from.
   * @param receiveMode The receive mode to use (defaults to PeekLock)
   * @param options Options for the receiver itself.
   */
  getReceiver(queueName: string, receiveMode: "peekLock"): Receiver<ReceivedMessageWithLock>;
  /**
   * Creates a receiver for an Azure Service Bus queue.
   *
   * @param queueName The name of the queue to receive from.
   * @param receiveMode The receive mode to use (defaults to PeekLock)
   * @param options Options for the receiver itself.
   */
  getReceiver(queueName: string, receiveMode: "receiveAndDelete"): Receiver<ReceivedMessage>;
  /**
   * Creates a receiver for an Azure Service Bus subscription.
   *
   * @param topicName Name of the topic for the subscription we want to receive from.
   * @param subscriptionName Name of the subscription (under the `topic`) that we want to receive from.
   * @param receiveMode The receive mode to use (defaults to PeekLock)
   * @param options Options for the receiver itself.
   */
  getReceiver(
    topicName: string,
    subscriptionName: string,
    receiveMode: "peekLock"
  ): Receiver<ReceivedMessageWithLock> & SubscriptionRuleManagement;
  /**
   * Creates a receiver for an Azure Service Bus subscription.
   *
   * @param topicName Name of the topic for the subscription we want to receive from.
   * @param subscriptionName Name of the subscription (under the `topic`) that we want to receive from.
   * @param receiveMode The receive mode to use (defaults to PeekLock)
   * @param options Options for the receiver itself.
   */
  getReceiver(
    topicName: string,
    subscriptionName: string,
    receiveMode: "receiveAndDelete"
  ): Receiver<ReceivedMessage> & SubscriptionRuleManagement;
  getReceiver(
    queueOrTopicName1: string,
    receiveModeOrSubscriptionName2: "peekLock" | "receiveAndDelete" | string,
    receiveMode3?: "peekLock" | "receiveAndDelete"
  ):
    | Receiver<ReceivedMessageWithLock>
    | Receiver<ReceivedMessage>
    | (Receiver<ReceivedMessageWithLock> & SubscriptionRuleManagement)
    | (Receiver<ReceivedMessage> & SubscriptionRuleManagement) {
    let entityPath: string;
    let receiveMode: "peekLock" | "receiveAndDelete";
    let entityType: "queue" | "subscription";

    if (isReceiveMode(receiveMode3)) {
      entityType = "subscription";
      const topic = queueOrTopicName1;
      const subscription = receiveModeOrSubscriptionName2;
      entityPath = `${topic}/Subscriptions/${subscription}`;
      receiveMode = receiveMode3;
    } else if (isReceiveMode(receiveModeOrSubscriptionName2)) {
      entityType = "queue";
      entityPath = queueOrTopicName1;
      receiveMode = receiveModeOrSubscriptionName2;
    } else {
      throw new TypeError("Invalid receiveMode provided");
    }

    const clientEntityContext = ClientEntityContext.create(
      entityPath,
      ClientType.ServiceBusReceiverClient,
      this._connectionContext,
      `${entityPath}/${generate_uuid()}`
    );

    if (receiveMode === "peekLock") {
      return new ReceiverImpl<ReceivedMessageWithLock>(
        clientEntityContext,
        receiveMode,
        entityType
      );
    } else {
      return new ReceiverImpl<ReceivedMessage>(clientEntityContext, receiveMode, entityType);
    }
  }

  /**
   * Creates a receiver for an Azure Service Bus queue.
   *
   * @param queueName The name of the queue to receive from.
   * @param receiveMode The receive mode to use (defaults to PeekLock)
   * @param options Options for the receiver itself.
   */
  getSessionReceiver(
    queueName: string,
    receiveMode: "peekLock",
    options?: GetSessionReceiverOptions
  ): SessionReceiver<ReceivedMessageWithLock>;
  /**
   * Creates a receiver for an Azure Service Bus queue.
   *
   * @param queueName The name of the queue to receive from.
   * @param receiveMode The receive mode to use (defaults to PeekLock)
   * @param options Options for the receiver itself.
   */
  getSessionReceiver(
    queueName: string,
    receiveMode: "receiveAndDelete",
    options?: GetSessionReceiverOptions
  ): SessionReceiver<ReceivedMessage>;
  /**
   * Creates a receiver for an Azure Service Bus subscription.
   *
   * @param topicName Name of the topic for the subscription we want to receive from.
   * @param subscriptionName Name of the subscription (under the `topic`) that we want to receive from.
   * @param receiveMode The receive mode to use (defaults to PeekLock)
   * @param options Options for the receiver itself.
   */
  getSessionReceiver(
    topicName: string,
    subscriptionName: string,
    receiveMode: "peekLock",
    options?: GetSessionReceiverOptions
  ): SessionReceiver<ReceivedMessageWithLock> & SubscriptionRuleManagement;
  /**
   * Creates a receiver for an Azure Service Bus subscription.
   *
   * @param topicName Name of the topic for the subscription we want to receive from.
   * @param subscriptionName Name of the subscription (under the `topic`) that we want to receive from.
   * @param receiveMode The receive mode to use (defaults to PeekLock)
   * @param options Options for the receiver itself.
   */
  getSessionReceiver(
    topicName: string,
    subscriptionName: string,
    receiveMode: "receiveAndDelete",
    options?: GetSessionReceiverOptions
  ): SessionReceiver<ReceivedMessage> & SubscriptionRuleManagement;
  getSessionReceiver(
    queueOrTopicName1: string,
    receiveModeOrSubscriptionName2: "peekLock" | "receiveAndDelete" | string,
    receiveModeOrOptions3?: "peekLock" | "receiveAndDelete" | GetSessionReceiverOptions,
    options4?: GetSessionReceiverOptions
  ):
    | SessionReceiver<ReceivedMessageWithLock>
    | SessionReceiver<ReceivedMessage>
    | (SessionReceiver<ReceivedMessage> & SubscriptionRuleManagement)
    | (SessionReceiver<ReceivedMessageWithLock> & SubscriptionRuleManagement) {
    let entityPath: string;
    let receiveMode: "peekLock" | "receiveAndDelete";
    let entityType: "queue" | "subscription";
    let options: GetSessionReceiverOptions | undefined;

    if (isReceiveMode(receiveModeOrOptions3)) {
      entityType = "subscription";
      const topic = queueOrTopicName1;
      const subscription = receiveModeOrSubscriptionName2;
      entityPath = `${topic}/Subscriptions/${subscription}`;
      receiveMode = receiveModeOrOptions3;
      options = options4;
    } else if (isReceiveMode(receiveModeOrSubscriptionName2)) {
      entityType = "queue";
      entityPath = queueOrTopicName1;
      receiveMode = receiveModeOrSubscriptionName2;
      options = receiveModeOrOptions3 as GetSessionReceiverOptions | undefined;
    } else {
      throw new TypeError("Invalid receiveMode provided");
    }

    const clientEntityContext = ClientEntityContext.create(
      entityPath,
      ClientType.ServiceBusReceiverClient,
      this._connectionContext,
      `${entityPath}/${generate_uuid()}`
    );

    // TODO: .NET actually tries to open the session here so we'd need to be async for that.
    return new SessionReceiverImpl(clientEntityContext, receiveMode, entityType, {
      sessionId: options?.sessionId,
      maxSessionAutoRenewLockDurationInSeconds: options?.maxSessionAutoRenewLockDurationInSeconds
    });
  }

  /**
   * Creates a Sender which can be used to send messages, schedule messages to be sent at a later time
   * and cancel such scheduled messages.
   */
  getSender(queueOrTopicName: string): Sender {
    const clientEntityContext = ClientEntityContext.create(
      queueOrTopicName,
      ClientType.ServiceBusReceiverClient,
      this._connectionContext,
      `${queueOrTopicName}/${generate_uuid()}`
    );

    return new SenderImpl(clientEntityContext);
  }

  /**
   * Closes the underlying AMQP connection.
   * NOTE: this will also disconnect any Receiver or Sender instances created from this
   * instance.
   */
  close(): Promise<void> {
    return ConnectionContext.close(this._connectionContext);
  }
}

function isReceiveMode(mode: any): mode is "peekLock" | "receiveAndDelete" {
  return mode && typeof mode === "string" && (mode === "peekLock" || mode === "receiveAndDelete");
}