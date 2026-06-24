using UnityEngine;

// Code-generated visuals so the slice has ZERO art-import dependencies.
// One shared 1x1 white sprite (1 pixel-per-unit); SpriteRenderer.color tints it,
// and transform.localScale sizes it in world units.
public static class SpriteFactory
{
    static Sprite _square;

    public static Sprite Square()
    {
        if (_square == null)
        {
            var tex = new Texture2D(1, 1, TextureFormat.RGBA32, false);
            tex.SetPixel(0, 0, Color.white);
            tex.filterMode = FilterMode.Point;
            tex.wrapMode = TextureWrapMode.Clamp;
            tex.Apply();
            _square = Sprite.Create(tex, new Rect(0, 0, 1, 1), new Vector2(0.5f, 0.5f), 1f);
        }
        return _square;
    }

    // A SpriteRenderer GameObject sized (size) at world pos, tinted col, on sorting `order`.
    public static GameObject Quad(string name, Vector2 pos, Vector2 size, Color col, int order = 0)
    {
        var go = new GameObject(name);
        go.transform.position = new Vector3(pos.x, pos.y, 0f);
        go.transform.localScale = new Vector3(size.x, size.y, 1f);
        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = Square();
        sr.color = col;
        sr.sortingOrder = order;
        return go;
    }
}
