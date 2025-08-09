/**
 * Filter an array in-place.
 * @param arr The array to filter in place.
 * @param predicate Predicate function called for each item to decide whether it should remain in the array (`true` if it should stay, `false` if it should go).
 */
export default function filterArrayInPlace<T>(
  arr: T[],
  predicate: (item: T) => boolean
): void {
  let nextKeptIndex = 0;
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (predicate(item)) {
      arr[nextKeptIndex] = item;
      nextKeptIndex++;
    }
  }
  arr.length = nextKeptIndex;
}
