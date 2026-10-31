// dbus-native exports its marshaller (package.json "./lib/*.js") without a type: the body bytes
// of one message with that signature, or a throw for a value the bus would refuse.
declare module "dbus-native/lib/marshall.js" {
  export default function marshall(signature: string, data: unknown[], offset?: number): Buffer;
}
