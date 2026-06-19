using UnityEngine;
using UnityEngine.EventSystems;

// The whole game builds itself from this one entry point — no scene setup required.
// Open the project, press Play, and everything below is spawned in code.
public static class GameBootstrap
{
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Launch()
    {
        // ---- Camera ----
        var camGO = new GameObject("Main Camera");
        var cam = camGO.AddComponent<Camera>();
        cam.orthographic = true;
        cam.orthographicSize = 6.5f;
        cam.backgroundColor = new Color(0.22f, 0.30f, 0.22f); // grassy
        cam.transform.position = new Vector3(0, 0, -10);
        camGO.tag = "MainCamera";
        var follow = camGO.AddComponent<CameraFollow>();

        // ---- Event system (for uGUI) ----
        new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));

        // ---- Game manager + UI ----
        var gm = new GameObject("GameManager").AddComponent<GameManager>();
        gm.BuildUI();

        // ---- Ground decoration: scattered darker tufts of grass ----
        var grassParent = new GameObject("Ground").transform;
        var rnd = new System.Random(12345);
        for (int i = 0; i < 140; i++)
        {
            var g = new GameObject("Tuft");
            g.transform.SetParent(grassParent);
            g.transform.position = new Vector3(
                (float)(rnd.NextDouble() * 28 - 14),
                (float)(rnd.NextDouble() * 28 - 14), 0);
            var sr = g.AddComponent<SpriteRenderer>();
            float shade = 0.18f + (float)rnd.NextDouble() * 0.12f;
            sr.color = new Color(shade, shade + 0.12f, shade, 1f);
            sr.sprite = Art.Solid(Color.white, 16);
            sr.sortingOrder = -10;
            g.transform.localScale = Vector3.one * (0.3f + (float)rnd.NextDouble() * 0.4f);
        }

        // ---- Arena walls (border + a few interior blocks) ----
        var wallColor = new Color(0.30f, 0.26f, 0.22f);
        float half = 15f, t = 0.6f;
        Wall(new Vector3(0, half, 0), new Vector3(half * 2, t, 1), wallColor);
        Wall(new Vector3(0, -half, 0), new Vector3(half * 2, t, 1), wallColor);
        Wall(new Vector3(half, 0, 0), new Vector3(t, half * 2, 1), wallColor);
        Wall(new Vector3(-half, 0, 0), new Vector3(t, half * 2, 1), wallColor);
        Wall(new Vector3(4, 3, 0), new Vector3(3, 1, 1), wallColor);
        Wall(new Vector3(-5, -4, 0), new Vector3(1, 4, 1), wallColor);
        Wall(new Vector3(7, -6, 0), new Vector3(4, 1, 1), wallColor);

        // ---- Player ----
        var player = MakePlayer();
        follow.target = player.transform;
        camGO.transform.position = new Vector3(0, 0, -10);

        // ---- NPC ----
        MakeNPC(new Vector3(-2.5f, 2.5f));

        // ---- Slimes ----
        var slimeSpots = new[]
        {
            new Vector3(6, 5, 0), new Vector3(-7, 6, 0), new Vector3(8, -3, 0),
            new Vector3(-8, -6, 0), new Vector3(3, -8, 0), new Vector3(10, 8, 0),
        };
        foreach (var s in slimeSpots) MakeSlime(s);
    }

    static void Wall(Vector3 pos, Vector3 size, Color color)
    {
        var go = new GameObject("Wall");
        go.transform.position = pos;
        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = Art.Solid(Color.white, 16);
        sr.color = color;
        sr.sortingOrder = -1;
        go.transform.localScale = size;
        var box = go.AddComponent<BoxCollider2D>();
        // sprite is 1 unit (16px/16ppu), so collider size 1 matches the localScale.
        box.size = Vector2.one;
    }

    static GameObject MakePlayer()
    {
        var go = new GameObject("Player");
        go.transform.position = Vector3.zero;
        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = Art.Circle(new Color(0.30f, 0.65f, 1f), 32);
        sr.sortingOrder = 5;
        go.transform.localScale = Vector3.one * 0.9f;

        // little eyes so you can read facing-ish / give it character
        var eye = new GameObject("Eyes");
        eye.transform.SetParent(go.transform, false);
        var esr = eye.AddComponent<SpriteRenderer>();
        esr.sprite = Art.Solid(Color.white, 16);
        esr.sortingOrder = 6;
        eye.transform.localScale = new Vector3(0.5f, 0.2f, 1f);
        eye.transform.localPosition = new Vector3(0, 0.1f, 0);

        var rb = go.AddComponent<Rigidbody2D>();
        rb.gravityScale = 0;
        rb.freezeRotation = true;
        rb.collisionDetectionMode = CollisionDetectionMode2D.Continuous;
        var col = go.AddComponent<CircleCollider2D>();
        col.radius = 0.45f;

        go.AddComponent<PlayerController>();
        return go;
    }

    static void MakeSlime(Vector3 pos)
    {
        var go = new GameObject("Slime");
        go.transform.position = pos;
        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = Art.Circle(new Color(0.45f, 0.85f, 0.4f), 32);
        sr.sortingOrder = 4;
        go.transform.localScale = Vector3.one;

        var rb = go.AddComponent<Rigidbody2D>();
        rb.gravityScale = 0;
        rb.freezeRotation = true;
        var col = go.AddComponent<CircleCollider2D>();
        col.radius = 0.45f;

        go.AddComponent<Enemy>();
    }

    static void MakeNPC(Vector3 pos)
    {
        var go = new GameObject("NPC");
        go.transform.position = pos;
        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = Art.Circle(new Color(0.95f, 0.8f, 0.45f), 32);
        sr.sortingOrder = 4;
        go.transform.localScale = Vector3.one * 0.95f;

        var rb = go.AddComponent<Rigidbody2D>();
        rb.bodyType = RigidbodyType2D.Static;
        var col = go.AddComponent<CircleCollider2D>();
        col.radius = 0.45f;

        go.AddComponent<NPC>();
    }
}
