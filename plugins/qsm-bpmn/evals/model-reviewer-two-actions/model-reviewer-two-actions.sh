#!/usr/bin/env bash
set -euo pipefail
mkdir -p models
cat >SPEC.md <<'X'
# Order fulfilment

The shop packs a paid order and sends the invoice. Payment ends in one of two outcomes: paid, or
payment failed. A failed payment notifies the customer and ends the order.
X
cat >models/shop.bpmn <<'X'
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="shop_defs" targetNamespace="https://example.org/shop">
  <bpmn:process id="order_process" name="An order from payment to dispatch" isExecutable="false">
    <bpmn:laneSet id="lanes">
      <bpmn:lane id="customer" name="Customer"><bpmn:flowNodeRef>placed</bpmn:flowNodeRef><bpmn:flowNodeRef>pay</bpmn:flowNodeRef></bpmn:lane>
      <bpmn:lane id="shop" name="Shop"><bpmn:flowNodeRef>paid</bpmn:flowNodeRef><bpmn:flowNodeRef>pack</bpmn:flowNodeRef><bpmn:flowNodeRef>notify</bpmn:flowNodeRef><bpmn:flowNodeRef>done</bpmn:flowNodeRef><bpmn:flowNodeRef>failed</bpmn:flowNodeRef></bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="placed" name="Order placed"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="pay" name="Pay the order"><bpmn:incoming>f1</bpmn:incoming><bpmn:outgoing>f2</bpmn:outgoing></bpmn:userTask>
    <bpmn:exclusiveGateway id="paid" name="Paid?"><bpmn:incoming>f2</bpmn:incoming><bpmn:outgoing>f3</bpmn:outgoing><bpmn:outgoing>f4</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:task id="pack" name="Pack the order, invoice sent"><bpmn:incoming>f3</bpmn:incoming><bpmn:outgoing>f5</bpmn:outgoing></bpmn:task>
    <bpmn:task id="notify" name="Notify the customer"><bpmn:incoming>f4</bpmn:incoming><bpmn:outgoing>f6</bpmn:outgoing></bpmn:task>
    <bpmn:endEvent id="done" name="Order dispatched"><bpmn:incoming>f5</bpmn:incoming></bpmn:endEvent>
    <bpmn:endEvent id="failed" name="Order cancelled"><bpmn:incoming>f6</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="placed" targetRef="pay" />
    <bpmn:sequenceFlow id="f2" sourceRef="pay" targetRef="paid" />
    <bpmn:sequenceFlow id="f3" name="yes" sourceRef="paid" targetRef="pack" />
    <bpmn:sequenceFlow id="f4" name="later" sourceRef="paid" targetRef="notify" />
    <bpmn:sequenceFlow id="f5" sourceRef="pack" targetRef="done" />
    <bpmn:sequenceFlow id="f6" sourceRef="notify" targetRef="failed" />
  </bpmn:process>
</bpmn:definitions>
X
