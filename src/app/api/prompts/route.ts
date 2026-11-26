import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, getPromptBySlugOrId, listPrompts } from "@/lib/db";
import { promptLikes, prompts } from "@/lib/db/schema";
import { generateToken } from "@/lib/password";
import { parseJsonObject, validatePromptPayload } from "./_validation";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const viewer = await getCurrentUser();

  const q = searchParams.get("q") ?? undefined;
  const scenario = searchParams.get("scenario") ?? undefined;
  const style = searchParams.get("style") ?? undefined;
  const color = searchParams.get("color") ?? undefined;
  const tool = searchParams.get("tool") ?? undefined;
  const sortRaw = searchParams.get("sort");
  const sort =
    sortRaw === "newest" || sortRaw === "copies" ? sortRaw : "popular";
  const scope = searchParams.get("scope"); // mine | favorites | liked

  let authorId: string | undefined;
  let favoritesOfUserId: string | undefined;
  let likedByUserId: string | undefined;
  let includePrivateForAuthorId: string | undefined;
  let visibility: "all" | "public" | "private" | undefined;

  if (scope === "mine") {
    if (!viewer) return NextResponse.json({ prompts: [] });
    authorId = viewer.id;
    includePrivateForAuthorId = viewer.id;
    const visibilityRaw = searchParams.get("visibility");
    if (
      visibilityRaw === "all" ||
      visibilityRaw === "public" ||
      visibilityRaw === "private"
    ) {
      visibility = visibilityRaw;
    }
  } else if (scope === "favorites") {
    if (!viewer) return NextResponse.json({ prompts: [] });
    favoritesOfUserId = viewer.id;
    includePrivateForAuthorId = viewer.id;
  } else if (scope === "liked") {
    if (!viewer) return NextResponse.json({ prompts: [] });
    likedByUserId = viewer.id;
    includePrivateForAuthorId = viewer.id;
  }

  const prompts = await listPrompts({
    q,
    scenario,
    style,
    color,
    tool,
    sort,
    authorId,
    favoritesOfUserId,
    likedByUserId,
    viewerId: viewer?.id,
    includePrivateForAuthorId,
    visibility,
  });

  return NextResponse.json({ prompts });
}

function makeSlug(englishTitle: string, title: string): string {
  const base = (englishTitle || title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
  const suffix = generateToken(3);
  return base ? `${base}-${suffix}` : `prompt-${suffix}`;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "请先登录后再发布提示词模板" },
        { status: 401 }
      );
    }

    const parsedBody = await parseJsonObject(request);
    if (!parsedBody.ok) {
      return NextResponse.json({ error: parsedBody.error }, { status: 400 });
    }
    const body = parsedBody.data;

    if (body.isPublic !== undefined && typeof body.isPublic !== "boolean") {
      return NextResponse.json(
        { error: "isPublic 必须为布尔值" },
        { status: 400 }
      );
    }

    const validated = validatePromptPayload(body);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const {
      title,
      englishTitle,
      summary,
      scenario,
      styleCategory,
      colorFamily,
      recommendedTools,
      tags,
      visualSpec,
      promptAnatomy,
      customNotes,
      sampleTopic,
      sampleSubtitle,
    } = validated.data;

    const isPublic = typeof body.isPublic === "boolean" ? body.isPublic : true;
    const rawRemixId =
      typeof body.remixedFromId === "string" ? body.remixedFromId.trim() : "";
    const remixOrigin = rawRemixId
      ? await getPromptBySlugOrId(rawRemixId, user.id)
      : null;
    const remixedFromId = remixOrigin ? remixOrigin.id : null;

    const id = `prompt_${generateToken(8)}`;
    const slug = makeSlug(englishTitle, title);
    const now = new Date().toISOString();

    await getDb().transaction(async (tx) => {
      await tx.insert(prompts).values({
        id,
        slug,
        title,
        englishTitle,
        summary,
        scenario,
        styleCategory,
        colorFamily,
        recommendedTools: recommendedTools.length ? recommendedTools : ["claude-html"],
        tags,
        visualSpec,
        promptAnatomy,
        customNotes,
        sampleTopic,
        sampleSubtitle,
        authorId: user.id,
        isOfficial: false,
        isPublic,
        remixedFromId,
        likesCount: 1,
        savesCount: 0,
        copiesCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(promptLikes).values({
        userId: user.id,
        promptId: id,
        createdAt: now,
      });
    });

    const created = await getPromptBySlugOrId(id, user.id);
    return NextResponse.json({ prompt: created }, { status: 201 });
  } catch (err) {
    console.error("Create prompt error:", err);
    return NextResponse.json(
      { error: "发布提示词失败，请检查输入并重试" },
      { status: 500 }
    );
  }
}
