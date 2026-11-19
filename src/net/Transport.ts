/**
 * 방장과 플레이어 사이의 연결. 1단계는 같은 페이지 안(LocalTransport),
 * 3단계에서 WebRTC 구현체를 추가한다. 메시지는 JSON 직렬화 가능해야 한다.
 */
export interface Transport<In, Out> {
  send(msg: Out): void;
  /** 해제 함수를 돌려준다 */
  onMessage(handler: (msg: In) => void): () => void;
  onClose(handler: () => void): () => void;
  close(): void;
}
