using UnityEngine;

// Entry point. Runs automatically on Play (no scene wiring needed) and builds the whole
// slice in code: camera, player, follow + HUD, and a procedural floor. Press R to regenerate.
public class Bootstrap : MonoBehaviour
{
    // False if this project's Active Input Handling is the new Input System only
    // (a fresh Unity 6 default), which makes UnityEngine.Input throw. The HUD shows the fix.
    public static bool InputReady = true;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Boot()
    {
        new GameObject("TrialTowers").AddComponent<Bootstrap>();
    }

    GameObject worldRoot;
    Player player;
    Camera cam;

    void Start()
    {
        // Probe legacy input once; if it's disabled this throws and we degrade gracefully.
        try { Input.GetKey(KeyCode.Space); InputReady = true; }
        catch { InputReady = false; }

        Physics2D.gravity = Vector2.zero;

        cam = Camera.main;
        if (cam == null)
        {
            var c = new GameObject("Main Camera");
            c.tag = "MainCamera";
            cam = c.AddComponent<Camera>();
        }
        cam.orthographic = true;
        cam.orthographicSize = 9.5f;
        cam.backgroundColor = new Color(0.05f, 0.05f, 0.07f);
        cam.transform.position = new Vector3(0f, 0f, -10f);

        var follow = cam.GetComponent<CameraFollow>();
        if (follow == null) follow = cam.gameObject.AddComponent<CameraFollow>();

        player = MakePlayer();
        follow.target = player.transform;

        var hud = cam.GetComponent<GameHUD>();
        if (hud == null) hud = cam.gameObject.AddComponent<GameHUD>();
        hud.player = player;

        Regenerate();
    }

    void Update()
    {
        if (InputReady && Input.GetKeyDown(KeyCode.R)) Regenerate();
    }

    void Regenerate()
    {
        if (worldRoot != null) Destroy(worldRoot);
        worldRoot = new GameObject("World");
        Vector2 spawn = WorldGen.Generate(worldRoot.transform, player != null ? player.transform : null);
        if (player != null)
        {
            player.transform.position = new Vector3(spawn.x, spawn.y, 0f);
            var rb = player.GetComponent<Rigidbody2D>();
            if (rb != null) rb.linearVelocity = Vector2.zero;
            player.hp = player.maxHp;
            player.dead = false;
        }
    }

    Player MakePlayer()
    {
        var go = new GameObject("Player");
        go.transform.localScale = new Vector3(0.8f, 0.8f, 1f);

        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = SpriteFactory.Square();
        sr.color = new Color(0.55f, 0.8f, 1f);
        sr.sortingOrder = 10;

        var rb = go.AddComponent<Rigidbody2D>();
        rb.gravityScale = 0f;
        rb.freezeRotation = true;
        rb.collisionDetectionMode = CollisionDetectionMode2D.Continuous;
        rb.interpolation = RigidbodyInterpolation2D.Interpolate;

        go.AddComponent<BoxCollider2D>();
        return go.AddComponent<Player>();
    }
}
