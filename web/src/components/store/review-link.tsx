"use client";

import { ClipboardCheck } from "lucide-react";
import { useEffect } from "react";

import { useSession } from "@/lib/auth";
import { type StoreMe, loadRemote, storeApi, useRemote } from "@/lib/store";

import { ButtonLink } from "../ui";

/**
 * 운영자에게만 보이는 '검토' 링크 (Store·Showroom 목록 → /store/manage/).
 * 운영자 여부는 로그인한 사람에게만 /api/store/me 가 알려 준다. 빌드된 HTML 에는 없다.
 * 숨기는 것은 편의일 뿐이고, 검토 권한은 API 가 판단한다.
 */
export function ReviewLink() {
  const session = useSession();
  const signedIn = session.status === "signed-in";
  const me = useRemote<StoreMe>(signedIn ? "me" : null);

  useEffect(() => {
    if (signedIn) void loadRemote("me", storeApi.me);
  }, [signedIn]);

  if (me?.status !== "ready" || !me.data.admin) return null;
  return (
    <ButtonLink href="/store/manage/" variant="ghost">
      <ClipboardCheck aria-hidden="true" className="size-4" />
      검토
    </ButtonLink>
  );
}
