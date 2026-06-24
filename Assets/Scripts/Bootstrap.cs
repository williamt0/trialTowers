using UnityEngine;

// Entry point. Runs automatically on Play (no scene wiring needed) and builds the whole
// slice in code: camera, player, follow + HUD, and a procedural floor. The loop:
// find the boss chamber -> beat the gatekeeper -> step into the portal -> descend (next floor).
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

    public int floorNum = 1;

    GameObject worldRoot;
    Player player;
    Camera cam;
    GameHUD hud;
    bool descendPending;

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

        hud = cam.GetComponent<GameHUD>();
        if (hud == null) hud = cam.gameObject.AddComponent<GameHUD>();
        hud.player = player;

        Regenerate();
    }

    void Update()
    {
        // descend is queued from the portal's trigger callback, then applied here (off the physics step)
        if (descendPending) { descendPending = false; floorNum++; Regenerate(); }
        if (InputReady && Input.GetKeyDown(KeyCode.R)) Regenerate();
    }

    // called by the open portal when the player steps in
    public void QueueDescend() { descendPending = true; }

    void Regenerate()
    {
        if (worldRoot != null) Destroy(worldRoot);
        worldRoot = new GameObject("World");
        Vector2 spawn = WorldGen.Generate(worldRoot.transform, player != null ? player.transform : null, QueueDescend, floorNum);
        if (player != null)
        {
            player.transform.position = new Vector3(spawn.x, spawn.y, 0f);
            var rb = player.GetComponent<Rigidbody2D>();
            if (rb != null) rb.linearVelocity = Vector2.zero;
            player.hp = player.maxHp;
            player.dead = false;
        }
        if (hud != null) hud.floor = floorNum;
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
