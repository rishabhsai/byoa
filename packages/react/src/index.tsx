import { useEffect, useState, type ReactNode } from "react";
import { BYOA, type DeviceLogin } from "@byoa/sdk";

export type ConnectAgentProps = {
  client: BYOA;
  children?: ReactNode;
  className?: string;
  onConnected?: () => void;
  onError?: (error: Error) => void;
};

export function ConnectAgent({
  client,
  children = "connect agent",
  className,
  onConnected,
  onError,
}: ConnectAgentProps) {
  const [login, setLogin] = useState<DeviceLogin>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!login) return;
    const complete = (event: Event) => {
      setPending(false);
      const result = (event as CustomEvent<{ success?: boolean; error?: string }>).detail;
      if (result?.success === false) {
        setLogin(undefined);
        onError?.(new Error(result.error ?? "agent sign-in failed"));
        return;
      }
      onConnected?.();
    };
    client.addEventListener("account/login/completed", complete, { once: true });
    return () => client.removeEventListener("account/login/completed", complete);
  }, [client, login, onConnected, onError]);

  const connect = async () => {
    setPending(true);
    try {
      await client.connect();
      const account = await client.readAccount() as { account?: unknown };
      if (account.account) {
        setPending(false);
        onConnected?.();
        return;
      }
      setLogin(await client.startDeviceLogin());
    } catch (cause) {
      setPending(false);
      onError?.(cause instanceof Error ? cause : new Error("agent connection failed"));
    }
  };

  if (login) {
    return (
      <div className={className} data-byoa-connect="device">
        <a href={login.verificationUrl} target="_blank" rel="noreferrer">open chatgpt</a>
        <code>{login.userCode}</code>
      </div>
    );
  }

  return (
    <button className={className} type="button" disabled={pending} onClick={connect}>
      {pending ? "connecting…" : children}
    </button>
  );
}
