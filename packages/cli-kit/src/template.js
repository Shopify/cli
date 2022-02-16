import {Liquid} from 'liquidjs';
// This line is necessary to register additional helpers.
export function template(templateContent) {
  return (data) => {
    const engine = new Liquid();
    return engine.render(engine.parse(templateContent), data);
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ0ZW1wbGF0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sVUFBVSxDQUFDO0FBRWhDLHlEQUF5RDtBQUN6RCxNQUFNLFVBQVUsUUFBUSxDQUFDLGVBQXVCO0lBQzlDLE9BQU8sQ0FBQyxJQUFZLEVBQW1CLEVBQUU7UUFDdkMsTUFBTSxNQUFNLEdBQUcsSUFBSSxNQUFNLEVBQUUsQ0FBQztRQUM1QixPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUM1RCxDQUFDLENBQUM7QUFDSixDQUFDIn0=
