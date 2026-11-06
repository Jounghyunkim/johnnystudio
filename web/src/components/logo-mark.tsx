/**
 * JohnnyStudio 브랜드 이미지 (원본: docs/johnny-*.png, 사이트용 사본: public/brand/).
 * 모두 투명 배경의 흰색 그림이다. 밝은 테마에서는 색을 뒤집어(light:invert) 검게 보인다.
 * 파비콘은 어두운 바탕을 깐 app/icon.png · app/apple-icon.png 다 (테마와 상관없이 같다).
 * 이미지를 바꿀 때는 파일 이름도 바꾼다 (nginx 가 이미지를 30일 동안 캐시한다).
 */
import { cx } from "./ui";

/**
 * 로봇 얼굴 마크 (140×96, 가로:세로 ≈ 1.46:1). 높이로 크기를 정한다 (h-6, h-7, h-12 …).
 * 작은 판(johnny-mark-icon.png, 94×64)은 휴대폰(화면 배율 3)에서 헤더 크기로도 흐려져서 쓰지 않는다.
 * h-12(48px)보다 크게 쓰면 배율 2 화면에서 흐려진다. 더 크게 쓰려면 SVG 나 더 큰 원본이 필요하다.
 */
export function LogoMark({ className = "h-7", alt = "" }: { className?: string; alt?: string }) {
  return <img src="/brand/johnny-mark.png" width={140} height={96} alt={alt} decoding="async" className={cx("w-auto light:invert", className)} />;
}

/** 로봇 얼굴 + JOHNNY STUDIO 글자 (정사각형 320×320) */
export function LogoFull({ className = "size-28", alt = "JohnnyStudio" }: { className?: string; alt?: string }) {
  return <img src="/brand/johnny-logo.png" width={320} height={320} alt={alt} decoding="async" className={cx("light:invert", className)} />;
}
