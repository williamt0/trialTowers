using UnityEngine;
using UnityEngine.UI;

// Generates all sprites and fonts procedurally so the project needs no imported art assets.
public static class Art
{
    public static Sprite Solid(Color color, int size = 16)
    {
        var tex = NewTex(size);
        var px = new Color[size * size];
        for (int i = 0; i < px.Length; i++) px[i] = color;
        tex.SetPixels(px);
        tex.Apply();
        return ToSprite(tex);
    }

    // A filled circle with a soft 1px edge — good for slimes, the player core, etc.
    public static Sprite Circle(Color color, int size = 32)
    {
        var tex = NewTex(size);
        float r = size * 0.5f;
        var px = new Color[size * size];
        for (int y = 0; y < size; y++)
        for (int x = 0; x < size; x++)
        {
            float dx = x + 0.5f - r, dy = y + 0.5f - r;
            float d = Mathf.Sqrt(dx * dx + dy * dy);
            float a = Mathf.Clamp01(r - d);
            px[y * size + x] = new Color(color.r, color.g, color.b, color.a * a);
        }
        tex.SetPixels(px);
        tex.Apply();
        return ToSprite(tex);
    }

    public static Font Font()
    {
        // Unity removed the old built-in Arial; LegacyRuntime.ttf is the modern stand-in.
        var f = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        if (f == null) f = Resources.GetBuiltinResource<Font>("Arial.ttf");
        return f;
    }

    static Texture2D NewTex(int size)
    {
        var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
        tex.filterMode = FilterMode.Point; // crisp pixel-art look
        tex.wrapMode = TextureWrapMode.Clamp;
        return tex;
    }

    static Sprite ToSprite(Texture2D tex)
    {
        // 16 pixels-per-unit keeps a 16px sprite roughly 1 world unit.
        return Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height),
            new Vector2(0.5f, 0.5f), 16f);
    }
}
