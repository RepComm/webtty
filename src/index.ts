
import { Button, Exponent, EXPONENT_CSS_BODY_STYLES, EXPONENT_CSS_STYLES, Input, Panel, Text } from "@repcomm/exponent-ts";
import { Modem } from "./modem";

EXPONENT_CSS_BODY_STYLES.mount(document.head);
EXPONENT_CSS_STYLES.mount(document.head);

async function main () {
  const container = new Panel()
  .setId("container")
  .mount(document.body);

  const terminalContainer = new Panel()
  .setId("terminal-container")
  .mount(container);

  const terminalInputContainer = new Panel()
  .setId("terminal-input-container")
  .mount(terminalContainer);

  const terminalInput = new Exponent()
  .make("textarea")
  .setId("terminal-input")
  .mount(terminalInputContainer);

  const terminalSendButton = new Button()
  .setId("terminal-send")
  .mount(terminalInputContainer)
  .setTextContent("Send");

  const terminalOutputContainer = new Panel()
  .setId("terminal-output-container")
  .mount(terminalContainer);

  const terminalOutput = new Text()
  .setId("terminal-output")
  .mount(terminalOutputContainer);

  const allowMic = new Button()
  .setId("allow-mic")
  .setTextContent("Allow Mic")
  .mount(terminalOutputContainer)
  .on("click", async ()=>{
    let stream = await navigator.mediaDevices.getUserMedia({audio: true});
    let mic = ctx.createMediaStreamSource(stream);
    modem.setInputNode(mic);
  });

  const signalDisplay = new Panel()
  .setId("signal-display")
  .mount(container);

  let ctx = new AudioContext();

  let modem = new Modem(ctx);

  modem.setOutputNode(ctx.destination);
  
  let textEncoder = new TextEncoder();

  terminalSendButton.on("click", (evt)=>{
    let data = textEncoder.encode((terminalInput.element as HTMLTextAreaElement).value);
    modem.send(data.buffer);
    modem.receive();
  });

}

main();
