using UnityEngine;

// A short-lived damage / heal number that floats up from a world point and fades out.
// It draws itself via IMGUI by projecting its world position to screen space each frame —
// no canvas or sprite needed. Parents to the floor root so it clears on regen, and self-destructs.
public class FloatingText : MonoBehaviour
{
    Vector3 world;
    string text;
    Color col;
    float t, size = 16f;
    const float Life = 0.8f;
    Camera cam;

    public static void Spawn(Vector2 pos, string text, Color col, float size = 16f)
    {
        var go = new GameObject("FloatingText");
        if (Bootstrap.WorldRoot != null) go.transform.SetParent(Bootstrap.WorldRoot);
        var ft = go.AddComponent<FloatingText>();
        ft.world = pos;
        ft.text = text;
        ft.col = col;
        ft.size = size;
    }

    void Awake() { cam = Camera.main; }

    void Update()
    {
        t += Time.deltaTime;
        world += Vector3.up * (1.6f * Time.deltaTime);   // drift upward
        if (t >= Life) Destroy(gameObject);
    }

    void OnGUI()
    {
        if (Bootstrap.Paused) return;                                  // hidden behind the title / cache / win screens
        if (Bootstrap.Hero != null && Bootstrap.Hero.dead) return;     // and behind the death screen
        if (cam == null) { cam = Camera.main; if (cam == null) return; }

        Vector3 sp = cam.WorldToScreenPoint(world);
        if (sp.z < 0f) return;                                         // behind the camera
        float a = 1f - Mathf.Clamp01(t / Life);
        float x = sp.x - 40f, y = (Screen.height - sp.y) - 10f;        // screen origin is bottom-left; GUI is top-left
        var style = new GUIStyle(GUI.skin.label) { alignment = TextAnchor.MiddleCenter, fontSize = Mathf.RoundToInt(size) };

        GUI.color = new Color(0f, 0f, 0f, a * 0.65f);
        GUI.Label(new Rect(x + 1f, y + 1f, 80f, 20f), text, style);    // drop shadow for legibility
        GUI.color = new Color(col.r, col.g, col.b, a);
        GUI.Label(new Rect(x, y, 80f, 20f), text, style);
        GUI.color = Color.white;
    }
}
