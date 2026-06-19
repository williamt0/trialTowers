using UnityEngine;

public class CameraFollow : MonoBehaviour
{
    public Transform target;
    public float smooth = 8f;

    void LateUpdate()
    {
        if (target == null) return;
        Vector3 goal = new Vector3(target.position.x, target.position.y, transform.position.z);
        transform.position = Vector3.Lerp(transform.position, goal, smooth * Time.deltaTime);
    }
}
