declare module '*.css';

interface BluetoothDevice extends EventTarget {
  id: string;
  name?: string;
  gatt: BluetoothRemoteGATTServer | null;
  watchAdvertisements(): Promise<void>;
  unwatchAdvertisements?(): void;
  watchingAdvertisements: boolean;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

interface BluetoothAdvertisingEvent extends Event {
  device: BluetoothDevice;
  rssi?: number;
  txPower?: number;
  appearance?: number;
  manufacturerData?: Map<number, DataView>;
  serviceData?: Map<string, DataView>;
  uuids?: string[];
}

interface Bluetooth {
  requestDevice(options?: { acceptAllDevices?: boolean; optionalServices?: string[]; filters?: Array<{ services?: string[]; name?: string; namePrefix?: string }> }): Promise<BluetoothDevice>;
  getAvailability?(): Promise<boolean>;
  getDevices?(): Promise<BluetoothDevice[]>;
}

interface Navigator {
  bluetooth?: Bluetooth;
}

// Type declarations for importing static assets
declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*.jpg' {
  const value: string;
  export default value;
}

declare module '*.jpeg' {
  const value: string;
  export default value;
}

declare module '*.gif' {
  const value: string;
  export default value;
}

declare module '*.webp' {
  const value: string;
  export default value;
}

declare module '*.ico' {
  const value: string;
  export default value;
}

declare module '*.json' {
  const value: any;
  export default value;
}

declare module '*.md' {
  const value: string;
  export default value;
}

declare module '*.csv' {
  const value: string;
  export default value;
}

declare namespace React {
  export interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
