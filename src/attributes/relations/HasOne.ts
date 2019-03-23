import { Schema as NormalizrSchema } from "normalizr";
import Schema from "../../schema/Schema";
import { Record, NormalizedData, Collection } from "../../data";
import Model from "../../model/Model";
import Query from "../../query/Query";
import Constraint from "../../query/contracts/RelationshipConstraint";
import DictionaryOne from "../contracts/DictionaryOne";
import Relation from "./Relation";

export default class HasOne extends Relation {
  /**
   * The related model.
   */
  related: typeof Model;

  /**
   * The foregin key of the related model.
   */
  foreignKey: string;

  /**
   * The local key of the model.
   */
  localKey: string;

  /**
   * Create a new has one instance.
   */
  constructor(model: typeof Model, related: typeof Model | string, foreignKey: string, localKey: string) {
    super(model); /* istanbul ignore next */

    this.related = this.model.relation(related);
    this.foreignKey = foreignKey;
    this.localKey = localKey;
  }

  /**
   * Define the normalizr schema for the relationship.
   */
  define(schema: Schema): NormalizrSchema {
    return schema.one(this.related);
  }

  /**
   * Attach the relational key to the related data. For example,
   * when User has one Phone, it will attach value to the
   * `user_id` field of Phone record.
   */
  attach(key: any, record: Record, data: NormalizedData): void {
    // Get related record.
    const related = data[this.related.entity];

    // If there's no related record, there's nothing we can do so return here.
    if (!related || !related[key]) {
      return;
    }

    // If there is a related record, check if the related record already has
    // proper foreign key value. If it has, that means the user has provided
    // the foreign key themselves so leave it alone and do nothing.
    if (related[key][this.foreignKey] !== undefined) {
      return;
    }

    // Check if the record has local key set. If not, set the local key to be
    // the id value. This happens if the user defines the custom local key
    // and didn't include it in the data being normalized.
    if (!record[this.localKey]) {
      record[this.localKey] = record.$id;
    }

    // Finally, set the foreign key of the related record to be the local
    // key of this record.
    related[key][this.foreignKey] = record[this.localKey];
  }

  /**
   * Make value to be set to model property. This method is used when
   * instantiating a model or creating a plain object from a model.
   */
  make(value: any, _parent: Record, _key: string): Model | null {
    if (!this.isOneRelation(value)) {
      return null;
    }

    return typeof value === "number" ? this.related.find(value) : new this.related(value);
  }

  /**
   * Load the has one relationship for the collection.
   */
  load(query: Query, collection: Collection, name: string, constraints: Constraint[]): void {
    const relation = this.getRelation(query, this.related.entity, constraints);

    this.addEagerConstraints(relation, collection);

    this.match(collection, relation.get(), name);
  }

  /**
   * Set the constraints for an eager load of the relation.
   */
  private addEagerConstraints(relation: Query, collection: Collection): void {
    relation.whereFk(this.foreignKey, this.getKeys(collection, this.localKey));
  }

  /**
   * Match the eagerly loaded results to their parents.
   */
  private match(collection: Collection, relations: Collection, name: string): void {
    const dictionary = this.buildDictionary(relations);

    collection.forEach(model => {
      const id = model[this.localKey];
      const relation = dictionary[id];

      model[name] = relation || null;
    });
  }

  /**
   * Build model dictionary keyed by the relation's foreign key.
   */
  private buildDictionary(relations: Collection): DictionaryOne {
    return relations.reduce<DictionaryOne>((dictionary, relation) => {
      const key = relation[this.foreignKey];

      dictionary[key] = relation;

      return dictionary;
    }, {});
  }
}
